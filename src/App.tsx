/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { UploadZone } from './components/UploadZone';
import { DocumentQueue } from './components/DocumentQueue';
import { ReviewModal } from './components/ReviewModal';
import { OperationalLedger } from './components/OperationalLedger';
import { SupabaseSetupModal } from './components/SupabaseSetupModal';
import { DocumentRecord, DocumentType, SystemStatus } from './types';
import { AlertCircle, CheckCircle2, FileText, Layers, RefreshCw, Database, AlertTriangle } from 'lucide-react';

export default function App() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [activeReviewDoc, setActiveReviewDoc] = useState<DocumentRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingQueueLength, setProcessingQueueLength] = useState(0);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [activeView, setActiveView] = useState<'capture' | 'ledger'>('capture');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data: SystemStatus = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch system status:', err);
    }
  }, []);

  // Fetch documents list
  const fetchDocuments = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchDocuments();
  }, [fetchStatus, fetchDocuments]);

  // Process uploaded files sequentially to satisfy the requirement:
  // "Process each document independently. Each stored independently, each processed independently."
  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProcessingQueueLength(files.length);
    showToast(`Uploading and extracting ${files.length} document(s)...`, 'info');

    let firstReviewDoc: DocumentRecord | null = null;
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProcessingQueueLength(files.length - i);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploaded_by', 'ops_admin');

      try {
        const res = await fetch('/api/upload-and-extract', {
          method: 'POST',
          body: formData,
        });

        let data: any;
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text || `Server error (HTTP ${res.status})` };
        }

        if (res.ok && data.success) {
          successCount++;
          const newDoc: DocumentRecord = data.document;

          // Update documents state
          setDocuments((prev) => {
            const filtered = prev.filter((d) => d.id !== newDoc.id);
            return [newDoc, ...filtered];
          });

          if (!firstReviewDoc && newDoc.processing_status === 'review_required') {
            firstReviewDoc = newDoc;
          }
        } else {
          showToast(`Upload failed for "${file.name}": ${data.error || 'Server rejected file'}`, 'error');
        }
      } catch (err: any) {
        showToast(`Upload error for "${file.name}": ${err.message}`, 'error');
      }
    }

    setIsProcessing(false);
    setProcessingQueueLength(0);
    await fetchDocuments();

    if (firstReviewDoc) {
      setActiveReviewDoc(firstReviewDoc);
      showToast(
        `Extracted ${successCount} document(s). Review screen opened for verification.`,
        'success'
      );
    } else if (successCount > 0) {
      showToast(`Successfully processed ${successCount} document(s).`, 'success');
    }
  };

  // Human Review: Approve
  const handleApprove = async (docId: string, docType: DocumentType) => {
    try {
      const res = await fetch(`/api/documents/${docId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          corrected_document_type: docType,
          reviewed_by: 'ops_admin',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.supabaseStored) {
          showToast('Approved! Stored in Supabase Database & Fleet Ledger.', 'success');
        } else {
          showToast('Approved! Stored in local ledger. (Run Supabase SQL migration to persist in database)', 'info');
        }
        setActiveReviewDoc(null);
        await fetchDocuments();
      } else {
        showToast(data.error || 'Failed to approve document', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error approving document', 'error');
    }
  };

  // Human Review: Save Corrections
  const handleSaveCorrections = async (
    docId: string,
    docType: DocumentType,
    correctedData: Record<string, any>
  ) => {
    try {
      const res = await fetch(`/api/documents/${docId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'correct',
          reviewed_data: correctedData,
          corrected_document_type: docType,
          reviewed_by: 'ops_admin',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.supabaseStored) {
          showToast('Corrections saved to Supabase Database & Fleet Ledger!', 'success');
        } else {
          showToast('Corrections saved in local ledger. (Run Supabase SQL migration to persist in database)', 'info');
        }
        setActiveReviewDoc(null);
        await fetchDocuments();
      } else {
        showToast(data.error || 'Failed to save corrections', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving corrections', 'error');
    }
  };

  // Re-run AI slip extraction with enhanced prompt / optional operator note
  const handleReExtract = async (docId: string, operatorHint?: string) => {
    try {
      showToast('Running deep slip re-scan with Gemini 2.5 Flash...', 'info');
      const res = await fetch(`/api/documents/${docId}/re-extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorHint }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Deep slip re-scan complete! Fields refreshed.', 'success');
        setActiveReviewDoc(data.document);
        await fetchDocuments();
      } else {
        showToast(data.error || 'Deep re-extraction failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error executing re-extraction', 'error');
    }
  };

  // Human Review: Reject
  const handleReject = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          reviewed_by: 'ops_admin',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Document marked as rejected. Evidence retained for audit.', 'info');
        setActiveReviewDoc(null);
        await fetchDocuments();
      } else {
        showToast(data.error || 'Failed to reject document', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error rejecting document', 'error');
    }
  };

  const reviewRequiredCount = documents.filter(
    (d) => d.processing_status === 'review_required'
  ).length;

  const approvedCount = documents.filter(
    (d) => d.processing_status === 'approved'
  ).length;

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* PrimeChain Header */}
      <Header
        status={status}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        documentCount={documents.length}
        reviewRequiredCount={reviewRequiredCount}
        approvedCount={approvedCount}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Supabase Migration Notice Banner */}
      {status?.supabaseConfigured && !status?.tablesReady && (
        <div className="bg-amber-50 border-b border-amber-300 px-4 py-2.5 sm:px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2 text-amber-950 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Supabase Action Required:</strong> Your project ({status.projectId || 'connected'}) needs PostgreSQL tables created before records will show in your Supabase dashboard.
              </span>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => setIsSupabaseModalOpen(true)}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold cursor-pointer transition-colors shadow-xs"
              >
                Run SQL Migration Script ↗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-top-3 duration-200">
          <div
            className={`flex items-center space-x-2.5 px-4 py-3 rounded-lg shadow-lg border text-xs font-semibold ${
              toastMessage.type === 'success'
                ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
                : toastMessage.type === 'error'
                ? 'bg-rose-900 text-rose-100 border-rose-700'
                : 'bg-slate-900 text-slate-100 border-slate-700'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-blue-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* VIEW 1: Document Capture & Ingestion Pipeline */}
        {activeView === 'capture' && (
          <div className="space-y-6">
            {/* Upload Zone */}
            <UploadZone
              onFilesSelected={handleFilesSelected}
              isProcessing={isProcessing}
              processingQueueLength={processingQueueLength}
            />

            {/* Ingestion Queue */}
            <DocumentQueue
              documents={documents}
              onSelectDocumentForReview={(doc) => setActiveReviewDoc(doc)}
              onRefresh={fetchDocuments}
              isRefreshing={isRefreshing}
            />
          </div>
        )}

        {/* VIEW 2: Fleet Operational Ledger & Lineage */}
        {activeView === 'ledger' && (
          <OperationalLedger
            documents={documents}
            onOpenDocumentReview={(doc) => setActiveReviewDoc(doc)}
          />
        )}
      </main>

      {/* Review Modal (Human-in-the-Loop) */}
      {activeReviewDoc && (
        <ReviewModal
          document={activeReviewDoc}
          onClose={() => setActiveReviewDoc(null)}
          onApprove={handleApprove}
          onSaveCorrections={handleSaveCorrections}
          onReject={handleReject}
          onReExtract={handleReExtract}
        />
      )}

      {/* Supabase Setup / Architecture Modal */}
      {isSupabaseModalOpen && (
        <SupabaseSetupModal
          status={status}
          onClose={() => setIsSupabaseModalOpen(false)}
          onRefreshStatus={() => {
            fetchStatus();
            fetchDocuments();
          }}
        />
      )}
    </div>
  );
}
