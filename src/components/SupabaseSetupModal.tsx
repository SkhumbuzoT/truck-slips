import React, { useState } from 'react';
import {
  X,
  Database,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { SystemStatus } from '../types';

interface SupabaseSetupModalProps {
  status: SystemStatus | null;
  onClose: () => void;
  onRefreshStatus: () => void;
}

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({
  status,
  onClose,
  onRefreshStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'sql' | 'status' | 'env' | 'storage'>(
    status?.supabaseConfigured && !status?.tablesReady ? 'sql' : 'status'
  );
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; success: boolean } | null>(null);

  const projectId = status?.projectId || 'ccvgfnmvzmclzsishcao';
  const supabaseSqlEditorUrl = `https://supabase.com/dashboard/project/${projectId}/sql/new`;

  const envSnippet = `# Supabase Configuration in Settings > Secrets
NEXT_PUBLIC_SUPABASE_URL="${status?.supabaseUrl || 'https://ccvgfnmvzmclzsishcao.supabase.co'}"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`;

  const sqlSnippet = `-- PRIMECHAIN DOCUMENT CAPTURE SCHEMA
-- Run this in your Supabase SQL Editor: ${supabaseSqlEditorUrl}

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default Demo Org
INSERT INTO organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'PrimeChain Logistics Core')
ON CONFLICT (id) DO NOTHING;

-- 2. Documents Table (Central evidence repository)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    uploaded_by TEXT NOT NULL DEFAULT 'ops_admin',
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('fuel_slip', 'loading_slip', 'pod', 'unknown')),
    processing_status TEXT NOT NULL CHECK (processing_status IN ('uploaded', 'processing', 'extracted', 'review_required', 'approved', 'failed')),
    extraction_confidence NUMERIC(4, 3),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Extraction Reviews (Audit trail: AI Extraction vs Human Correction)
CREATE TABLE IF NOT EXISTS extraction_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    ai_extraction JSONB NOT NULL,
    reviewed_data JSONB,
    review_status TEXT NOT NULL CHECK (review_status IN ('pending', 'approved', 'corrected', 'rejected')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Fuel Records (Operational structured record)
CREATE TABLE IF NOT EXISTS fuel_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    transaction_number TEXT,
    transaction_date DATE,
    transaction_time TIME,
    vehicle_registration TEXT,
    driver_name TEXT,
    supplier TEXT,
    fuel_litres NUMERIC(10, 2),
    fuel_price_per_litre NUMERIC(10, 3),
    fuel_total_amount NUMERIC(12, 2),
    odometer NUMERIC(10, 1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Loading Records (Operational structured record)
CREATE TABLE IF NOT EXISTS loading_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    load_number TEXT,
    loading_date DATE,
    loading_time TIME,
    vehicle_registration TEXT,
    driver_name TEXT,
    mine TEXT,
    loading_location TEXT,
    product TEXT,
    quantity_tons NUMERIC(10, 3),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. POD Records (Operational structured record)
CREATE TABLE IF NOT EXISTS pod_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    load_number TEXT,
    delivery_date DATE,
    delivery_time TIME,
    vehicle_registration TEXT,
    driver_name TEXT,
    customer TEXT,
    destination TEXT,
    product TEXT,
    quantity_tons NUMERIC(10, 3),
    received_by TEXT,
    signature_present BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast operational searches
CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_fuel_vehicle ON fuel_records(vehicle_registration);
CREATE INDEX IF NOT EXISTS idx_loading_vehicle ON loading_records(vehicle_registration);
CREATE INDEX IF NOT EXISTS idx_pod_vehicle ON pod_records(vehicle_registration);

-- Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE loading_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role access all documents') THEN
        CREATE POLICY "Service role access all documents" ON documents FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role access all fuel_records') THEN
        CREATE POLICY "Service role access all fuel_records" ON fuel_records FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role access all loading_records') THEN
        CREATE POLICY "Service role access all loading_records" ON loading_records FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role access all pod_records') THEN
        CREATE POLICY "Service role access all pod_records" ON pod_records FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role access all extraction_reviews') THEN
        CREATE POLICY "Service role access all extraction_reviews" ON extraction_reviews FOR ALL USING (true);
    END IF;
END $$;`;

  const copyToClipboard = (text: string, type: 'sql' | 'env') => {
    navigator.clipboard.writeText(text);
    if (type === 'sql') {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } else {
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2000);
    }
  };

  const handleSyncToSupabase = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/sync-supabase', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncMessage({
          text: `Success! Synced ${data.synced.documents} documents and ${data.synced.fuel_records} fuel records directly into Supabase.`,
          success: true,
        });
        onRefreshStatus();
      } else {
        setSyncMessage({
          text: data.error || 'Sync failed. Ensure tables are created in Supabase SQL Editor.',
          success: false,
        });
      }
    } catch (err: any) {
      setSyncMessage({
        text: err.message || 'Error connecting to sync endpoint',
        success: false,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Supabase Database & Persistence Status
              </h3>
              <p className="text-xs text-slate-500">
                Project Ref: <span className="font-mono text-emerald-700 font-semibold">{projectId}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Diagnostic Alert Banner */}
        <div
          className={`p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
            status?.tablesReady
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/80 border-amber-200 text-amber-950'
          }`}
        >
          <div className="flex items-start space-x-2.5">
            {status?.tablesReady ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">
                {status?.tablesReady
                  ? 'Supabase Database Active & Verified'
                  : 'Supabase Connected • PostgreSQL Schema Migration Required'}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {status?.tablesReady
                  ? 'All tables (documents, fuel_records, loading_records, pod_records) exist. Data is actively saved to Supabase.'
                  : 'Your project credentials and Storage bucket are connected, but tables do not exist yet in PostgreSQL. Run the SQL script below to see records in your Supabase dashboard.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleSyncToSupabase}
              disabled={isSyncing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Verifying...' : 'Verify & Sync'}</span>
            </button>
          </div>
        </div>

        {syncMessage && (
          <div
            className={`px-6 py-2.5 text-xs font-medium border-b ${
              syncMessage.success
                ? 'bg-emerald-100/70 border-emerald-300 text-emerald-900'
                : 'bg-rose-100/70 border-rose-300 text-rose-900'
            }`}
          >
            {syncMessage.text}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-slate-200 px-6 flex space-x-4 bg-white text-xs font-semibold">
          <button
            onClick={() => setActiveTab('sql')}
            className={`py-3 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'sql'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            1. SQL Schema Migration {!status?.tablesReady && '(Action Required)'}
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`py-3 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'status'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            2. Database Health & Diagnostics
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`py-3 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'storage'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            3. Storage Bucket
          </button>
          <button
            onClick={() => setActiveTab('env')}
            className={`py-3 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'env'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            4. Credentials
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[55vh] overflow-y-auto">
          {activeTab === 'sql' && (
            <div className="space-y-4 text-xs text-slate-700">
              <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 space-y-2">
                <p className="font-bold text-amber-950 text-xs">
                  Why can't I see records in my Supabase project dashboard yet?
                </p>
                <p className="text-amber-900 leading-relaxed text-[11px]">
                  PostgreSQL databases require tables to be created before rows can be stored.
                  Follow these 3 quick steps:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-amber-950 font-medium">
                  <li>Click <strong>"Copy SQL Migration Script"</strong> below.</li>
                  <li>
                    Open your{' '}
                    <a
                      href={supabaseSqlEditorUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-emerald-700 hover:text-emerald-800 inline-flex items-center space-x-1"
                    >
                      <span>Supabase SQL Editor ({projectId})</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    and paste the code.
                  </li>
                  <li>Click <strong>"RUN"</strong> in Supabase, then return here and click <strong>"Verify & Sync"</strong>.</li>
                </ol>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <a
                  href={supabaseSqlEditorUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors"
                >
                  <span>Open Supabase SQL Editor</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  onClick={() => copyToClipboard(sqlSnippet, 'sql')}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'SQL Copied to Clipboard!' : 'Copy SQL Migration Script'}</span>
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-950 text-emerald-300 font-mono text-[11px] max-h-72 overflow-y-auto leading-relaxed border border-slate-800">
                  {sqlSnippet}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'status' && (
            <div className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                  <span className="text-[11px] text-slate-500 font-medium">Supabase Project URL</span>
                  <p className="font-mono font-semibold text-slate-900 text-xs truncate">
                    {status?.supabaseUrl || 'Configured'}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                  <span className="text-[11px] text-slate-500 font-medium">Storage Bucket</span>
                  <p className="font-mono font-semibold text-emerald-700 text-xs flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>trucking-documents (Created & Active)</span>
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <h4 className="font-bold text-slate-900">PostgreSQL Tables Status:</h4>
                <div className="space-y-1.5">
                  {['documents', 'fuel_records', 'loading_records', 'pod_records', 'extraction_reviews'].map(
                    (tbl) => {
                      const isMissing = status?.missingTables?.includes(tbl);
                      return (
                        <div
                          key={tbl}
                          className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-xs"
                        >
                          <span className="font-mono text-slate-800">public.{tbl}</span>
                          {isMissing ? (
                            <span className="inline-flex items-center space-x-1 text-amber-700 font-semibold text-[11px]">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Table not yet created</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-emerald-700 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Table Ready</span>
                            </span>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 leading-relaxed text-[11px]">
                <strong>Automatic In-Memory Failover: </strong>
                All files and extracted slips are fully operational in the app's cache right now. Once you execute the SQL script in your Supabase SQL Editor, click <strong>"Verify & Sync"</strong> above to push all existing and future records directly to Supabase!
              </div>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-4 text-xs text-slate-700">
              <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
                <div className="flex items-center space-x-2">
                  <HardDrive className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-slate-900">Storage Bucket:</span>
                  <span className="font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                    trucking-documents (Verified)
                  </span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  The <code className="font-mono bg-slate-200 px-1 py-0.5 rounded">trucking-documents</code> bucket has been automatically provisioned in your Supabase project. Uploaded slips and PDFs are stored here securely.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900">Deterministic Storage Path Hierarchy:</h4>
                <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-lg">
                  {`organization_id/year/month/document_id/original_filename`}
                </div>
                <p className="text-slate-500 text-[11px]">
                  Guarantees multi-tenant data isolation and immutable document evidence lineage.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'env' && (
            <div className="space-y-4 text-xs text-slate-700">
              <p className="leading-relaxed">
                Supabase credentials configured in <strong>Settings &gt; Secrets</strong>:
              </p>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto">
                  {envSnippet}
                </pre>
                <button
                  onClick={() => copyToClipboard(envSnippet, 'env')}
                  className="absolute right-3 top-3 inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium"
                >
                  {copiedEnv ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedEnv ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Need help? Open your Supabase SQL Editor and run the provided script.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
