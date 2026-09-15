import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import {
  DocumentRecord,
  DocumentType,
  ExtractionReviewRecord,
  FuelRecord,
  LoadingRecord,
  PodRecord,
  RawExtractionData,
  SystemStatus,
} from './src/types';
import { extractDocumentWithGemini } from './server/gemini-extractor';
import {
  getSupabaseAdmin,
  isSupabaseConfigured,
  ensureStorageBucket,
  checkSupabaseHealth,
  BUCKET_NAME,
} from './src/lib/supabase';

dotenv.config();

const app = express();
const PORT = 3000;
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer in-memory storage for fast streaming and validation with 50MB support and all image types
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = [
      '.pdf',
      '.jpg',
      '.jpeg',
      '.png',
      '.webp',
      '.heic',
      '.heif',
      '.jfif',
      '.bmp',
      '.tiff',
      '.tif',
      '.gif',
    ];

    if (
      mime.startsWith('image/') ||
      mime === 'application/pdf' ||
      mime === 'application/octet-stream' ||
      mime === '' ||
      allowedExtensions.includes(ext)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file format: ${file.mimetype || ext}. Please upload images (JPG, PNG, WEBP, HEIC) or PDF documents.`
        )
      );
    }
  },
});

// Dual-layer state: in-memory cache for instant operational reactivity + Supabase Postgres/Storage persistence
interface StoredFileCache {
  buffer: Buffer;
  mimeType: string;
  originalFilename: string;
}

const fileCache = new Map<string, StoredFileCache>();
const documentStore = new Map<string, DocumentRecord>();
const reviewStore = new Map<string, ExtractionReviewRecord>();
const fuelStore = new Map<string, FuelRecord>();
const loadingStore = new Map<string, LoadingRecord>();
const podStore = new Map<string, PodRecord>();

// Helper to construct Supabase storage path
function buildStoragePath(orgId: string, documentId: string, filename: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${orgId}/${year}/${month}/${documentId}/${sanitizedFilename}`;
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health & Configuration Status
app.get('/api/status', async (_req: Request, res: Response) => {
  const health = await checkSupabaseHealth();

  const status: SystemStatus = {
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    supabaseConfigured: health.configured,
    supabaseStorageBucket: BUCKET_NAME,
    supabaseUrl: health.cleanUrl,
    storageReady: health.storageReady,
    tablesReady: health.tablesReady,
    projectId: health.projectId,
    missingTables: health.missingTables,
    supabaseError: health.errorMessage,
  };

  res.json(status);
});

// 2b. Re-run Extraction with optional operator guidance
app.post('/api/documents/:id/re-extract', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { operatorHint } = req.body || {};

    const doc = documentStore.get(id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    let fileBuffer: Buffer | null = null;
    let mimeType = doc.mime_type;

    const cached = fileCache.get(id);
    if (cached) {
      fileBuffer = cached.buffer;
      mimeType = cached.mimeType;
    } else {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data, error } = await supabase.storage.from(BUCKET_NAME).download(doc.storage_path);
        if (!error && data) {
          const ab = await data.arrayBuffer();
          fileBuffer = Buffer.from(ab);
        }
      }
    }

    if (!fileBuffer) {
      res.status(400).json({ error: 'Document file content could not be retrieved for re-extraction' });
      return;
    }

    const extractionData = await extractDocumentWithGemini(
      fileBuffer,
      mimeType,
      doc.original_filename,
      operatorHint
    );

    const processedIso = new Date().toISOString();
    const existingReview = reviewStore.get(id);
    const reviewId = existingReview?.id || randomUUID();

    const reviewRecord: ExtractionReviewRecord = {
      id: reviewId,
      document_id: id,
      ai_extraction: extractionData,
      reviewed_data: null,
      review_status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      created_at: existingReview?.created_at || processedIso,
    };

    reviewStore.set(id, reviewRecord);

    const updatedDoc: DocumentRecord = {
      ...doc,
      document_type: extractionData.document_type,
      processing_status: 'review_required',
      extraction_confidence: extractionData.confidence,
      processed_at: processedIso,
      updated_at: processedIso,
      extraction_review: reviewRecord,
    };

    documentStore.set(id, updatedDoc);

    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        await supabase.from('documents').update({
          document_type: extractionData.document_type,
          processing_status: 'review_required',
          extraction_confidence: extractionData.confidence,
          processed_at: processedIso,
          updated_at: processedIso,
        }).eq('id', id);

        await supabase.from('extraction_reviews').upsert(reviewRecord, { onConflict: 'id' });
      } catch (e: any) {
        console.warn('[Supabase Re-extract sync warning]:', e?.message);
      }
    }

    res.json({
      success: true,
      document: updatedDoc,
      extraction: extractionData,
    });
  } catch (err: any) {
    console.error('[Re-extract Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to re-extract document' });
  }
});

// 2c. Sync Local Records to Supabase
app.post('/api/sync-supabase', async (_req: Request, res: Response): Promise<void> => {
  const health = await checkSupabaseHealth();
  if (!health.configured) {
    res.status(400).json({ success: false, error: 'Supabase credentials not configured' });
    return;
  }

  if (!health.tablesReady) {
    res.status(400).json({
      success: false,
      error: `PostgreSQL tables not found in Supabase: ${health.missingTables.join(', ')}. Please run the SQL schema migration in Supabase SQL Editor.`,
      missingTables: health.missingTables,
      health,
    });
    return;
  }

  const supabase = getSupabaseAdmin()!;
  let syncedDocs = 0;
  let syncedReviews = 0;
  let syncedFuel = 0;
  let syncedLoading = 0;
  let syncedPods = 0;

  try {
    for (const doc of documentStore.values()) {
      const { error } = await supabase.from('documents').upsert({
        id: doc.id,
        organization_id: doc.organization_id,
        uploaded_by: doc.uploaded_by,
        original_filename: doc.original_filename,
        storage_path: doc.storage_path,
        mime_type: doc.mime_type,
        file_size: doc.file_size,
        document_type: doc.document_type,
        processing_status: doc.processing_status,
        extraction_confidence: doc.extraction_confidence,
        uploaded_at: doc.uploaded_at,
        processed_at: doc.processed_at,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
      }, { onConflict: 'id' });
      if (!error) syncedDocs++;
    }

    for (const rev of reviewStore.values()) {
      const { error } = await supabase.from('extraction_reviews').upsert(rev, { onConflict: 'id' });
      if (!error) syncedReviews++;
    }

    for (const f of fuelStore.values()) {
      const { error } = await supabase.from('fuel_records').upsert(f, { onConflict: 'id' });
      if (!error) syncedFuel++;
    }

    for (const l of loadingStore.values()) {
      const { error } = await supabase.from('loading_records').upsert(l, { onConflict: 'id' });
      if (!error) syncedLoading++;
    }

    for (const p of podStore.values()) {
      const { error } = await supabase.from('pod_records').upsert(p, { onConflict: 'id' });
      if (!error) syncedPods++;
    }

    res.json({
      success: true,
      message: 'All local records successfully synchronized to Supabase PostgreSQL!',
      synced: {
        documents: syncedDocs,
        reviews: syncedReviews,
        fuel_records: syncedFuel,
        loading_records: syncedLoading,
        pod_records: syncedPods,
      },
      health,
    });
  } catch (err: any) {
    console.error('[Supabase Full Sync Exception]:', err);
    res.status(500).json({ success: false, error: err.message || 'Sync failed' });
  }
});

// 2. Upload Document & Run Gemini Extraction
app.post(
  '/api/upload-and-extract',
  (req: Request, res: Response): void => {
    upload.single('file')(req, res, async (uploadErr: any) => {
      if (uploadErr) {
        console.error('[Upload Multer Error]:', uploadErr);
        res.status(400).json({
          success: false,
          error: uploadErr.message || 'File upload failed. Ensure the file is a valid image or PDF under 50MB.',
        });
        return;
      }

      try {
        const file = req.file;
        if (!file) {
          res.status(400).json({ success: false, error: 'No document file provided.' });
          return;
        }

        const documentId = randomUUID();
        const orgId = (req.body.organization_id as string) || DEFAULT_ORG_ID;
        const uploadedBy = (req.body.uploaded_by as string) || 'ops_admin';

        // Infer and normalize MIME type if browser passed application/octet-stream or image/jpg
        let detectedMime = (file.mimetype || '').toLowerCase();
        const ext = path.extname(file.originalname).toLowerCase();
        if (detectedMime === 'application/octet-stream' || !detectedMime || detectedMime === 'image/jpg') {
          if (ext === '.pdf') detectedMime = 'application/pdf';
          else if (ext === '.png') detectedMime = 'image/png';
          else if (ext === '.webp') detectedMime = 'image/webp';
          else if (ext === '.heic') detectedMime = 'image/heic';
          else if (ext === '.heif') detectedMime = 'image/heif';
          else detectedMime = 'image/jpeg';
        }

        const storagePath = buildStoragePath(orgId, documentId, file.originalname);

        // Cache file locally for instant review previews
        fileCache.set(documentId, {
          buffer: file.buffer,
          mimeType: detectedMime,
          originalFilename: file.originalname,
        });

        // 1. Store in Supabase Storage if configured
        const supabase = getSupabaseAdmin();
        let supabaseUploadSuccess = false;

        if (supabase) {
          try {
            await ensureStorageBucket();
            const { error: uploadError } = await supabase.storage
              .from(BUCKET_NAME)
              .upload(storagePath, file.buffer, {
                contentType: detectedMime,
                upsert: true,
              });

            if (uploadError) {
              console.warn('[Supabase Storage] Upload warning:', uploadError.message);
            } else {
              supabaseUploadSuccess = true;
            }
          } catch (storageErr) {
            console.error('[Supabase Storage] Exception:', storageErr);
          }
        }

        const nowIso = new Date().toISOString();

        // Initial Document Record in state
        const initialDoc: DocumentRecord = {
          id: documentId,
          organization_id: orgId,
          uploaded_by: uploadedBy,
          original_filename: file.originalname,
          storage_path: storagePath,
          mime_type: detectedMime,
          file_size: file.size,
          document_type: 'unknown',
          processing_status: 'processing',
          extraction_confidence: null,
          uploaded_at: nowIso,
          processed_at: null,
          created_at: nowIso,
          updated_at: nowIso,
          file_url: `/api/document-file/${documentId}`,
        };

        documentStore.set(documentId, initialDoc);

        // Save initial record in Supabase Postgres if configured
        let supabaseDbSaved = false;
        let supabaseDbError: string | null = null;
        if (supabase) {
          try {
            const { error: dbErr } = await supabase.from('documents').upsert({
              id: documentId,
              organization_id: orgId,
              uploaded_by: uploadedBy,
              original_filename: file.originalname,
              storage_path: storagePath,
              mime_type: detectedMime,
              file_size: file.size,
              document_type: 'unknown',
              processing_status: 'processing',
              extraction_confidence: null,
              uploaded_at: nowIso,
              created_at: nowIso,
              updated_at: nowIso,
            }, { onConflict: 'id' });
            if (dbErr) {
              supabaseDbError = dbErr.message;
              console.warn('[Supabase DB] Documents insert warning:', dbErr.message);
            } else {
              supabaseDbSaved = true;
            }
          } catch (dbErr: any) {
            supabaseDbError = dbErr?.message || 'Database insert failed';
            console.warn('[Supabase DB] Documents insert exception:', dbErr);
          }
        }

        // 2. Run Gemini Extraction with fallback to manual review
        let extractionData: RawExtractionData;
        try {
          extractionData = await extractDocumentWithGemini(
            file.buffer,
            detectedMime,
            file.originalname
          );
        } catch (geminiError: any) {
          console.warn('[Document Extraction Fallback]:', geminiError?.message || geminiError);
          // When automated extraction cannot fully parse, provide an empty review template
          // so the user can still see the image, verify, and fill fields manually
          extractionData = {
            document_type: 'unknown',
            confidence: 0,
            reasoning: 'Image uploaded. Automatic extraction could not identify fields (' + (geminiError?.message || 'manual review required') + '). Please review the document.',
            fuel_slip_data: null,
            loading_slip_data: null,
            pod_data: null,
          };
        }

      // 3. Save raw extraction to review audit table
      const processedIso = new Date().toISOString();
      const reviewId = randomUUID();

      const reviewRecord: ExtractionReviewRecord = {
        id: reviewId,
        document_id: documentId,
        ai_extraction: extractionData,
        reviewed_data: null,
        review_status: 'pending',
        reviewed_by: null,
        reviewed_at: null,
        created_at: processedIso,
      };

      reviewStore.set(documentId, reviewRecord);

      // 4. Update document status to review_required
      const updatedDoc: DocumentRecord = {
        ...initialDoc,
        document_type: extractionData.document_type,
        processing_status: 'review_required',
        extraction_confidence: extractionData.confidence,
        processed_at: processedIso,
        updated_at: processedIso,
        extraction_review: reviewRecord,
      };

      documentStore.set(documentId, updatedDoc);

      // Persist extraction and review in Supabase
      if (supabase) {
        try {
          const { error: revErr } = await supabase.from('extraction_reviews').upsert({
            id: reviewId,
            document_id: documentId,
            ai_extraction: extractionData,
            reviewed_data: null,
            review_status: 'pending',
            created_at: processedIso,
          }, { onConflict: 'id' });

          const { error: updErr } = await supabase
            .from('documents')
            .update({
              document_type: extractionData.document_type,
              processing_status: 'review_required',
              extraction_confidence: extractionData.confidence,
              processed_at: processedIso,
              updated_at: processedIso,
            })
            .eq('id', documentId);

          if (!revErr && !updErr) {
            supabaseDbSaved = true;
          }
        } catch (dbErr: any) {
          console.warn('[Supabase DB] Review insert warning:', dbErr);
        }
      }

      res.status(200).json({
        success: true,
        document: updatedDoc,
        extraction: extractionData,
        supabaseStorageStored: supabaseUploadSuccess,
        supabaseDbStored: supabaseDbSaved,
        supabaseDbError: supabaseDbError,
      });
    } catch (err: any) {
      console.error('[Upload Handler Error]:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });
});

// 3. Fetch Document File for in-app viewing (supports PDF and images)
app.get('/api/document-file/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  // Check in-memory cache first
  const cached = fileCache.get(id);
  if (cached) {
    res.setHeader('Content-Type', cached.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${cached.originalFilename}"`);
    res.send(cached.buffer);
    return;
  }

  // Otherwise try fetching from Supabase Storage
  const supabase = getSupabaseAdmin();
  const doc = documentStore.get(id);

  if (supabase && doc) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .download(doc.storage_path);

      if (!error && data) {
        const arrayBuf = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        res.setHeader('Content-Type', doc.mime_type);
        res.setHeader('Content-Disposition', `inline; filename="${doc.original_filename}"`);
        res.send(buffer);
        return;
      }
    } catch (fetchErr) {
      console.error('[Supabase Storage Download Error]:', fetchErr);
    }
  }

  res.status(404).send('Document file not found.');
});

// 4. List All Documents (with review & operational record linkages)
app.get('/api/documents', async (_req: Request, res: Response) => {
  // If Supabase is connected, optionally pull newest records
  const supabase = getSupabaseAdmin();
  if (supabase && documentStore.size === 0) {
    try {
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (docs) {
        for (const doc of docs) {
          const docId = doc.id;
          const { data: rev } = await supabase
            .from('extraction_reviews')
            .select('*')
            .eq('document_id', docId)
            .single();

          documentStore.set(docId, {
            ...doc,
            file_url: `/api/document-file/${docId}`,
            extraction_review: rev || undefined,
          });
        }
      }
    } catch (err) {
      console.warn('[Supabase Sync Documents]:', err);
    }
  }

  const documents = Array.from(documentStore.values()).map((doc) => {
    const rev = reviewStore.get(doc.id);
    let opRecord: FuelRecord | LoadingRecord | PodRecord | null = null;
    if (doc.document_type === 'fuel_slip') {
      opRecord = fuelStore.get(doc.id) || null;
    } else if (doc.document_type === 'loading_slip') {
      opRecord = loadingStore.get(doc.id) || null;
    } else if (doc.document_type === 'pod') {
      opRecord = podStore.get(doc.id) || null;
    }

    return {
      ...doc,
      file_url: `/api/document-file/${doc.id}`,
      extraction_review: rev || doc.extraction_review,
      operational_record: opRecord,
    };
  });

  // Sort by latest created
  documents.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  res.json({ documents });
});

// 5. Get Single Document by ID
app.get('/api/documents/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const doc = documentStore.get(id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const rev = reviewStore.get(id);
  let opRecord: FuelRecord | LoadingRecord | PodRecord | null = null;
  if (doc.document_type === 'fuel_slip') {
    opRecord = fuelStore.get(id) || null;
  } else if (doc.document_type === 'loading_slip') {
    opRecord = loadingStore.get(id) || null;
  } else if (doc.document_type === 'pod') {
    opRecord = podStore.get(id) || null;
  }

  res.json({
    document: {
      ...doc,
      file_url: `/api/document-file/${doc.id}`,
      extraction_review: rev || doc.extraction_review,
      operational_record: opRecord,
    },
  });
});

// 6. Review & Approval Action (Approve, Save Corrections, Reject)
app.post('/api/documents/:id/review', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, reviewed_data, reviewed_by, corrected_document_type } = req.body;

    const doc = documentStore.get(id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const review = reviewStore.get(id);
    const nowIso = new Date().toISOString();
    const reviewer = reviewed_by || 'ops_admin';

    const supabase = getSupabaseAdmin();
    const docType: DocumentType =
      corrected_document_type || doc.document_type;

    if (action === 'reject') {
      // 1. REJECT: Do not create operational record; update audit status
      if (review) {
        review.review_status = 'rejected';
        review.reviewed_by = reviewer;
        review.reviewed_at = nowIso;
        reviewStore.set(id, review);
      }

      doc.processing_status = 'failed';
      doc.updated_at = nowIso;
      documentStore.set(id, doc);

      if (supabase) {
        await supabase
          .from('extraction_reviews')
          .update({
            review_status: 'rejected',
            reviewed_by: reviewer,
            reviewed_at: nowIso,
          })
          .eq('document_id', id);

        await supabase
          .from('documents')
          .update({
            processing_status: 'failed',
            updated_at: nowIso,
          })
          .eq('id', id);
      }

      res.json({
        success: true,
        action: 'rejected',
        message: 'Document was rejected. No operational record created. Original document preserved for audit.',
        document: doc,
      });
      return;
    }

    // Determine final data to save
    const isApprove = action === 'approve';
    const isCorrect = action === 'correct';

    if (!isApprove && !isCorrect) {
      res.status(400).json({ error: 'Invalid action. Must be approve, correct, or reject.' });
      return;
    }

    const reviewStatus = isApprove ? 'approved' : 'corrected';
    let finalData: Record<string, any> = reviewed_data;

    // If straight approve without custom edits, pull from raw AI extraction
    if (isApprove && (!finalData || Object.keys(finalData).length === 0)) {
      if (docType === 'fuel_slip') {
        finalData = review?.ai_extraction.fuel_slip_data || {};
      } else if (docType === 'loading_slip') {
        finalData = review?.ai_extraction.loading_slip_data || {};
      } else if (docType === 'pod') {
        finalData = review?.ai_extraction.pod_data || {};
      } else {
        finalData = {};
      }
    }

    // Update Extraction Review
    if (review) {
      review.reviewed_data = finalData;
      review.review_status = reviewStatus;
      review.reviewed_by = reviewer;
      review.reviewed_at = nowIso;
      reviewStore.set(id, review);
    }

    // Update Document status
    doc.document_type = docType;
    doc.processing_status = 'approved';
    doc.updated_at = nowIso;
    documentStore.set(id, doc);

    if (supabase) {
      await supabase
        .from('extraction_reviews')
        .update({
          reviewed_data: finalData,
          review_status: reviewStatus,
          reviewed_by: reviewer,
          reviewed_at: nowIso,
        })
        .eq('document_id', id);

      await supabase
        .from('documents')
        .update({
          document_type: docType,
          processing_status: 'approved',
          updated_at: nowIso,
        })
        .eq('id', id);
    }

    // Create or update the specific operational record
    let createdOperationalRecord: FuelRecord | LoadingRecord | PodRecord | null = null;
    let supabaseRecordSaved = false;
    let supabaseRecordError: string | null = null;
    const opRecordId = randomUUID();

    if (docType === 'fuel_slip') {
      const fuelRecord: FuelRecord = {
        id: opRecordId,
        document_id: id,
        organization_id: doc.organization_id,
        transaction_number: finalData.transaction_number || null,
        transaction_date: finalData.transaction_date || null,
        transaction_time: finalData.transaction_time || null,
        vehicle_registration: finalData.vehicle_registration || null,
        driver_name: finalData.driver_name || null,
        supplier: finalData.supplier || null,
        fuel_litres:
          finalData.fuel_litres !== null && finalData.fuel_litres !== undefined
            ? Number(finalData.fuel_litres)
            : null,
        fuel_price_per_litre:
          finalData.fuel_price_per_litre !== null && finalData.fuel_price_per_litre !== undefined
            ? Number(finalData.fuel_price_per_litre)
            : null,
        fuel_total_amount:
          finalData.fuel_total_amount !== null && finalData.fuel_total_amount !== undefined
            ? Number(finalData.fuel_total_amount)
            : null,
        odometer:
          finalData.odometer !== null && finalData.odometer !== undefined
            ? Number(finalData.odometer)
            : null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      fuelStore.set(id, fuelRecord);
      createdOperationalRecord = fuelRecord;

      if (supabase) {
        try {
          const { error: fErr } = await supabase.from('fuel_records').upsert(fuelRecord, { onConflict: 'id' });
          if (fErr) {
            supabaseRecordError = fErr.message;
            console.warn('[Supabase DB] fuel_records insert warning:', fErr.message);
          } else {
            supabaseRecordSaved = true;
          }
        } catch (dbErr: any) {
          supabaseRecordError = dbErr?.message;
          console.error('[Supabase DB] fuel_records insert error:', dbErr);
        }
      }
    } else if (docType === 'loading_slip') {
      const loadingRecord: LoadingRecord = {
        id: opRecordId,
        document_id: id,
        organization_id: doc.organization_id,
        load_number: finalData.load_number || null,
        loading_date: finalData.loading_date || null,
        loading_time: finalData.loading_time || null,
        vehicle_registration: finalData.vehicle_registration || null,
        driver_name: finalData.driver_name || null,
        mine: finalData.mine || null,
        loading_location: finalData.loading_location || null,
        product: finalData.product || null,
        quantity_tons:
          finalData.quantity_tons !== null && finalData.quantity_tons !== undefined
            ? Number(finalData.quantity_tons)
            : null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      loadingStore.set(id, loadingRecord);
      createdOperationalRecord = loadingRecord;

      if (supabase) {
        try {
          const { error: lErr } = await supabase.from('loading_records').upsert(loadingRecord, { onConflict: 'id' });
          if (lErr) {
            supabaseRecordError = lErr.message;
            console.warn('[Supabase DB] loading_records insert warning:', lErr.message);
          } else {
            supabaseRecordSaved = true;
          }
        } catch (dbErr: any) {
          supabaseRecordError = dbErr?.message;
          console.error('[Supabase DB] loading_records insert error:', dbErr);
        }
      }
    } else if (docType === 'pod') {
      const podRecord: PodRecord = {
        id: opRecordId,
        document_id: id,
        organization_id: doc.organization_id,
        load_number: finalData.load_number || null,
        delivery_date: finalData.delivery_date || null,
        delivery_time: finalData.delivery_time || null,
        vehicle_registration: finalData.vehicle_registration || null,
        driver_name: finalData.driver_name || null,
        customer: finalData.customer || null,
        destination: finalData.destination || null,
        product: finalData.product || null,
        quantity_tons:
          finalData.quantity_tons !== null && finalData.quantity_tons !== undefined
            ? Number(finalData.quantity_tons)
            : null,
        received_by: finalData.received_by || null,
        signature_present:
          typeof finalData.signature_present === 'boolean'
            ? finalData.signature_present
            : null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      podStore.set(id, podRecord);
      createdOperationalRecord = podRecord;

      if (supabase) {
        try {
          const { error: pErr } = await supabase.from('pod_records').upsert(podRecord, { onConflict: 'id' });
          if (pErr) {
            supabaseRecordError = pErr.message;
            console.warn('[Supabase DB] pod_records insert warning:', pErr.message);
          } else {
            supabaseRecordSaved = true;
          }
        } catch (dbErr: any) {
          supabaseRecordError = dbErr?.message;
          console.error('[Supabase DB] pod_records insert error:', dbErr);
        }
      }
    }

    res.json({
      success: true,
      action: reviewStatus,
      document: doc,
      operational_record: createdOperationalRecord,
      review: review,
      supabaseStored: supabaseRecordSaved,
      supabaseError: supabaseRecordError,
    });
  } catch (err: any) {
    console.error('[Review Processing Error]:', err);
    res.status(500).json({ error: err.message || 'Error processing review' });
  }
});

// 7. Operational Records Query (Supports cross-document lineage)
app.get('/api/operational-records', async (_req: Request, res: Response) => {
  const fuel = Array.from(fuelStore.values());
  const loading = Array.from(loadingStore.values());
  const pods = Array.from(podStore.values());

  // Link documents to each operational record
  const enrichedFuel = fuel.map((f) => ({
    ...f,
    document: documentStore.get(f.document_id) || null,
  }));

  const enrichedLoading = loading.map((l) => ({
    ...l,
    document: documentStore.get(l.document_id) || null,
  }));

  const enrichedPods = pods.map((p) => ({
    ...p,
    document: documentStore.get(p.document_id) || null,
  }));

  res.json({
    fuel_records: enrichedFuel,
    loading_records: enrichedLoading,
    pod_records: enrichedPods,
  });
});

// 8. Retrieve SQL Migration Schema
app.get('/api/schema-sql', (_req: Request, res: Response) => {
  try {
    const schemaPath = path.join(process.cwd(), 'src', 'lib', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    res.type('text/plain').send(sql);
  } catch {
    res.status(500).send('-- Schema file could not be read');
  }
});

// ----------------------------------------------------
// VITE INTEGRATION & SERVER START
// ----------------------------------------------------

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PrimeChain Document Capture Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
