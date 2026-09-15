import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseAdminClient: SupabaseClient | null = null;

export const BUCKET_NAME = 'trucking-documents';

/**
 * Normalizes Supabase project URL by removing accidental /rest/v1 or trailing slashes
 * that would cause PostgREST to return PGRST125 Invalid Path error.
 */
export function normalizeSupabaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return '';
  return rawUrl.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

/**
 * Extracts project ref/id from a Supabase URL (e.g. ccvgfnmvzmclzsishcao)
 */
export function getSupabaseProjectId(url: string | undefined): string | null {
  const clean = normalizeSupabaseUrl(url);
  if (!clean) return null;
  try {
    const parsed = new URL(clean);
    const hostParts = parsed.hostname.split('.');
    if (hostParts.length >= 3 && hostParts[1] === 'supabase') {
      return hostParts[0];
    }
  } catch {
    // fallback regex
    const match = clean.match(/https?:\/\/([^.]+)\.supabase\.co/i);
    if (match) return match[1];
  }
  return null;
}

export function isSupabaseConfigured(): boolean {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;
  const cleanUrl = normalizeSupabaseUrl(rawUrl);
  return Boolean(cleanUrl && key && !cleanUrl.includes('your-project'));
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseAdminClient) {
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const cleanUrl = normalizeSupabaseUrl(rawUrl);
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY)!;

    supabaseAdminClient = createClient(cleanUrl, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseAdminClient;
}

export async function ensureStorageBucket(): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      console.warn('[Supabase] Could not list buckets:', error.message);
      return false;
    }

    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);
    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
      });
      if (createError) {
        console.warn('[Supabase] Could not create bucket:', createError.message);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Storage bucket check error:', err);
    return false;
  }
}

export interface SupabaseHealthCheck {
  configured: boolean;
  rawUrl: string;
  cleanUrl: string;
  projectId: string | null;
  storageReady: boolean;
  tablesReady: boolean;
  existingTables: string[];
  missingTables: string[];
  errorMessage: string | null;
}

export async function checkSupabaseHealth(): Promise<SupabaseHealthCheck> {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const cleanUrl = normalizeSupabaseUrl(rawUrl);
  const projectId = getSupabaseProjectId(cleanUrl);
  const configured = isSupabaseConfigured();

  if (!configured) {
    return {
      configured: false,
      rawUrl,
      cleanUrl,
      projectId,
      storageReady: false,
      tablesReady: false,
      existingTables: [],
      missingTables: ['documents', 'fuel_records', 'loading_records', 'pod_records', 'extraction_reviews'],
      errorMessage: 'Supabase credentials not configured in environment',
    };
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return {
      configured: false,
      rawUrl,
      cleanUrl,
      projectId,
      storageReady: false,
      tablesReady: false,
      existingTables: [],
      missingTables: ['documents', 'fuel_records', 'loading_records', 'pod_records', 'extraction_reviews'],
      errorMessage: 'Failed to initialize Supabase client',
    };
  }

  let storageReady = false;
  try {
    storageReady = await ensureStorageBucket();
  } catch {
    storageReady = false;
  }

  // Check essential tables
  const tablesToCheck = [
    'documents',
    'fuel_records',
    'loading_records',
    'pod_records',
    'extraction_reviews',
  ];
  const existingTables: string[] = [];
  const missingTables: string[] = [];
  let tableErrorMsg: string | null = null;

  for (const tbl of tablesToCheck) {
    try {
      const { error } = await sb.from(tbl).select('id').limit(1);
      if (error) {
        missingTables.push(tbl);
        if (!tableErrorMsg) tableErrorMsg = error.message;
      } else {
        existingTables.push(tbl);
      }
    } catch (e: any) {
      missingTables.push(tbl);
      if (!tableErrorMsg) tableErrorMsg = e.message;
    }
  }

  const tablesReady = missingTables.length === 0;

  return {
    configured: true,
    rawUrl,
    cleanUrl,
    projectId,
    storageReady,
    tablesReady,
    existingTables,
    missingTables,
    errorMessage: tablesReady ? null : tableErrorMsg || 'Some tables not created in Supabase',
  };
}
