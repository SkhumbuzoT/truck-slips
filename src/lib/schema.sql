-- PRIMECHAIN DOCUMENT CAPTURE SCHEMA
-- Supabase Postgres Migration Script

-- Enable uuid-ossp extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default demo organization for initialization
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

-- OPERATIONAL LINKAGE INDEXES
-- Designed for fast cross-document lineage (Vehicle Registration & Load Number)
CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);

CREATE INDEX IF NOT EXISTS idx_fuel_vehicle ON fuel_records(vehicle_registration);
CREATE INDEX IF NOT EXISTS idx_fuel_date ON fuel_records(transaction_date);
CREATE INDEX IF NOT EXISTS idx_fuel_doc ON fuel_records(document_id);

CREATE INDEX IF NOT EXISTS idx_loading_vehicle ON loading_records(vehicle_registration);
CREATE INDEX IF NOT EXISTS idx_loading_load_number ON loading_records(load_number);
CREATE INDEX IF NOT EXISTS idx_loading_date ON loading_records(loading_date);
CREATE INDEX IF NOT EXISTS idx_loading_doc ON loading_records(document_id);

CREATE INDEX IF NOT EXISTS idx_pod_vehicle ON pod_records(vehicle_registration);
CREATE INDEX IF NOT EXISTS idx_pod_load_number ON pod_records(load_number);
CREATE INDEX IF NOT EXISTS idx_pod_date ON pod_records(delivery_date);
CREATE INDEX IF NOT EXISTS idx_pod_doc ON pod_records(document_id);

CREATE INDEX IF NOT EXISTS idx_reviews_doc ON extraction_reviews(document_id);

-- SUPABASE STORAGE BUCKET SETUP
-- Creates the 'trucking-documents' bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('trucking-documents', 'trucking-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE loading_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_records ENABLE ROW LEVEL SECURITY;

-- Service role full access policy for server-side operations (idempotent)
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
END $$;
