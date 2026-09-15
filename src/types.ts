export type DocumentType = 'fuel_slip' | 'loading_slip' | 'pod' | 'unknown';

export type ProcessingStatus =
  | 'uploaded'
  | 'processing'
  | 'extracted'
  | 'review_required'
  | 'approved'
  | 'failed';

export type ReviewStatus = 'pending' | 'approved' | 'corrected' | 'rejected';

export interface DocumentRecord {
  id: string;
  organization_id: string;
  uploaded_by: string;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  document_type: DocumentType;
  processing_status: ProcessingStatus;
  extraction_confidence: number | null;
  uploaded_at: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  file_url?: string;
  extraction_review?: ExtractionReviewRecord;
  operational_record?: FuelRecord | LoadingRecord | PodRecord | null;
}

export interface FuelRecord {
  id: string;
  document_id: string;
  organization_id: string;
  transaction_number: string | null;
  transaction_date: string | null;
  transaction_time: string | null;
  vehicle_registration: string | null;
  driver_name: string | null;
  supplier: string | null;
  fuel_litres: number | null;
  fuel_price_per_litre: number | null;
  fuel_total_amount: number | null;
  odometer: number | null;
  created_at: string;
  updated_at: string;
}

export interface LoadingRecord {
  id: string;
  document_id: string;
  organization_id: string;
  load_number: string | null;
  loading_date: string | null;
  loading_time: string | null;
  vehicle_registration: string | null;
  driver_name: string | null;
  mine: string | null;
  loading_location: string | null;
  product: string | null;
  quantity_tons: number | null;
  created_at: string;
  updated_at: string;
}

export interface PodRecord {
  id: string;
  document_id: string;
  organization_id: string;
  load_number: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  vehicle_registration: string | null;
  driver_name: string | null;
  customer: string | null;
  destination: string | null;
  product: string | null;
  quantity_tons: number | null;
  received_by: string | null;
  signature_present: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ExtractionReviewRecord {
  id: string;
  document_id: string;
  ai_extraction: RawExtractionData;
  reviewed_data: Record<string, unknown> | null;
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface RawExtractionData {
  document_type: DocumentType;
  confidence: number;
  reasoning?: string;
  fuel_slip_data?: {
    transaction_number: string | null;
    transaction_date: string | null;
    transaction_time: string | null;
    vehicle_registration: string | null;
    driver_name: string | null;
    supplier: string | null;
    fuel_litres: number | null;
    fuel_price_per_litre: number | null;
    fuel_total_amount: number | null;
    odometer: number | null;
  };
  loading_slip_data?: {
    load_number: string | null;
    loading_date: string | null;
    loading_time: string | null;
    vehicle_registration: string | null;
    driver_name: string | null;
    mine: string | null;
    loading_location: string | null;
    product: string | null;
    quantity_tons: number | null;
  };
  pod_data?: {
    load_number: string | null;
    delivery_date: string | null;
    delivery_time: string | null;
    vehicle_registration: string | null;
    driver_name: string | null;
    customer: string | null;
    destination: string | null;
    product: string | null;
    quantity_tons: number | null;
    received_by: string | null;
    signature_present: boolean | null;
  };
}

export interface SystemStatus {
  geminiConfigured: boolean;
  supabaseConfigured: boolean;
  supabaseStorageBucket: string;
  supabaseUrl: string | null;
  storageReady: boolean;
  tablesReady: boolean;
  projectId: string | null;
  missingTables: string[];
  supabaseError?: string | null;
}
