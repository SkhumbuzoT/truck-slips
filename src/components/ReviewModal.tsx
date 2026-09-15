import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  FileText,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Save,
  Ban,
  Fuel,
  Scale,
  FileCheck2,
  ExternalLink,
  Calculator,
  RefreshCw,
} from 'lucide-react';
import { DocumentRecord, DocumentType } from '../types';

interface ReviewModalProps {
  document: DocumentRecord;
  onClose: () => void;
  onApprove: (docId: string, docType: DocumentType) => Promise<void>;
  onSaveCorrections: (
    docId: string,
    docType: DocumentType,
    correctedData: Record<string, any>
  ) => Promise<void>;
  onReject: (docId: string) => Promise<void>;
  onReExtract?: (docId: string, operatorHint?: string) => Promise<void>;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  document: doc,
  onClose,
  onApprove,
  onSaveCorrections,
  onReject,
  onReExtract,
}) => {
  const [selectedType, setSelectedType] = useState<DocumentType>(
    doc.document_type !== 'unknown' ? doc.document_type : 'fuel_slip'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmingReject, setIsConfirmingReject] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [isReExtracting, setIsReExtracting] = useState(false);
  const [showHintInput, setShowHintInput] = useState(false);
  const [operatorHint, setOperatorHint] = useState('');

  // Raw AI extraction
  const aiExtract = doc.extraction_review?.ai_extraction;

  // Form state
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Has user edited any field?
  const [hasEdits, setHasEdits] = useState(false);

  // Auto calculation helpers for fuel slips
  const handleCalcRate = () => {
    const litres = parseFloat(formData.fuel_litres);
    const total = parseFloat(formData.fuel_total_amount);
    if (!isNaN(litres) && !isNaN(total) && litres > 0 && total > 0) {
      const calcRate = (total / litres).toFixed(3);
      handleFieldChange('fuel_price_per_litre', calcRate);
    }
  };

  const handleCalcTotal = () => {
    const litres = parseFloat(formData.fuel_litres);
    const rate = parseFloat(formData.fuel_price_per_litre);
    if (!isNaN(litres) && !isNaN(rate) && litres > 0 && rate > 0) {
      const calcTotal = (litres * rate).toFixed(2);
      handleFieldChange('fuel_total_amount', calcTotal);
    }
  };

  // Convert kg to metric tons if slip displays gross or net weight in kg
  const handleConvertKgToTons = () => {
    const qty = parseFloat(formData.quantity_tons);
    if (!isNaN(qty) && qty > 500) {
      const inTons = (qty / 1000).toFixed(3);
      handleFieldChange('quantity_tons', inTons);
    }
  };

  const handleTriggerReExtract = async () => {
    if (!onReExtract) return;
    setIsReExtracting(true);
    try {
      await onReExtract(doc.id, operatorHint.trim() || undefined);
      setShowHintInput(false);
      setOperatorHint('');
    } finally {
      setIsReExtracting(false);
    }
  };

  // Initialize form data based on detected type and AI extraction
  useEffect(() => {
    let initial: Record<string, any> = {};

    if (selectedType === 'fuel_slip') {
      const data =
        doc.extraction_review?.reviewed_data ||
        aiExtract?.fuel_slip_data ||
        {};
      initial = {
        vehicle_registration: data.vehicle_registration ?? '',
        supplier: data.supplier ?? '',
        transaction_number: data.transaction_number ?? '',
        transaction_date: data.transaction_date ?? '',
        transaction_time: data.transaction_time ?? '',
        fuel_litres: data.fuel_litres !== null && data.fuel_litres !== undefined ? String(data.fuel_litres) : '',
        fuel_price_per_litre:
          data.fuel_price_per_litre !== null && data.fuel_price_per_litre !== undefined
            ? String(data.fuel_price_per_litre)
            : '',
        fuel_total_amount:
          data.fuel_total_amount !== null && data.fuel_total_amount !== undefined
            ? String(data.fuel_total_amount)
            : '',
        odometer: data.odometer !== null && data.odometer !== undefined ? String(data.odometer) : '',
      };
    } else if (selectedType === 'loading_slip') {
      const data =
        doc.extraction_review?.reviewed_data ||
        aiExtract?.loading_slip_data ||
        {};
      initial = {
        vehicle_registration: data.vehicle_registration ?? '',
        load_number: data.load_number ?? '',
        mine: data.mine ?? '',
        loading_location: data.loading_location ?? '',
        product: data.product ?? '',
        quantity_tons:
          data.quantity_tons !== null && data.quantity_tons !== undefined
            ? String(data.quantity_tons)
            : '',
        loading_date: data.loading_date ?? '',
        loading_time: data.loading_time ?? '',
      };
    } else if (selectedType === 'pod') {
      const data =
        doc.extraction_review?.reviewed_data ||
        aiExtract?.pod_data ||
        {};
      initial = {
        vehicle_registration: data.vehicle_registration ?? '',
        load_number: data.load_number ?? '',
        customer: data.customer ?? '',
        destination: data.destination ?? '',
        product: data.product ?? '',
        quantity_tons:
          data.quantity_tons !== null && data.quantity_tons !== undefined
            ? String(data.quantity_tons)
            : '',
        delivery_date: data.delivery_date ?? '',
        delivery_time: data.delivery_time ?? '',
        received_by: data.received_by ?? '',
        signature_present: data.signature_present === true ? 'true' : data.signature_present === false ? 'false' : '',
      };
    }

    setFormData(initial);
    setHasEdits(false);
  }, [selectedType, doc]);

  const handleFieldChange = (field: string, val: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: val,
    }));
    setHasEdits(true);
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      if (hasEdits) {
        await onSaveCorrections(doc.id, selectedType, cleanFormValues());
      } else {
        await onApprove(doc.id, selectedType);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCorrections = async () => {
    setIsSubmitting(true);
    try {
      await onSaveCorrections(doc.id, selectedType, cleanFormValues());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!isConfirmingReject) {
      setIsConfirmingReject(true);
      return;
    }
    setIsSubmitting(true);
    try {
      await onReject(doc.id);
    } finally {
      setIsSubmitting(false);
      setIsConfirmingReject(false);
    }
  };

  // Convert empty strings to null for backend storage
  const cleanFormValues = () => {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(formData)) {
      if (v === '' || v === undefined) {
        cleaned[k] = null;
      } else if (
        ['fuel_litres', 'fuel_price_per_litre', 'fuel_total_amount', 'odometer', 'quantity_tons'].includes(
          k
        )
      ) {
        cleaned[k] = isNaN(Number(v)) ? null : Number(v);
      } else if (k === 'signature_present') {
        cleaned[k] = v === 'true' ? true : v === 'false' ? false : null;
      } else {
        cleaned[k] = v;
      }
    }
    return cleaned;
  };

  const isPdf =
    doc.mime_type.toLowerCase() === 'application/pdf' ||
    doc.original_filename.toLowerCase().endsWith('.pdf');

  const fileUrl = doc.file_url || `/api/document-file/${doc.id}`;

  const confidencePct = doc.extraction_confidence
    ? Math.round(doc.extraction_confidence * 100)
    : 85;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div
        id="review-modal-card"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Top Operational Bar */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-900">
                  Human-in-the-Loop Document Review
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800">
                  Document ID: {doc.id.slice(0, 8)}...
                </span>
              </div>
              <p className="text-xs text-slate-500">
                AI extracts the draft. Human operator verifies & approves. Only verified data enters the database.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Extraction Confidence */}
            <div className="text-right hidden sm:block">
              <p className="text-[11px] text-slate-500 font-medium">AI Confidence</p>
              <div className="flex items-center space-x-1.5">
                <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      confidencePct >= 85
                        ? 'bg-emerald-500'
                        : confidencePct >= 65
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${confidencePct}%` }}
                  />
                </div>
                <span className="text-xs font-bold font-mono text-slate-800">
                  {confidencePct}%
                </span>
              </div>
            </div>

            <button
              id="btn-close-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Split Screen (Left: Original Document, Right: Editable Fields) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          {/* Left Column: Original Document Viewer (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900/95 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200 h-[360px] lg:h-auto overflow-hidden">
            {/* Viewer Toolbar */}
            <div className="px-4 py-2 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
              <span className="truncate max-w-[200px]" title={doc.original_filename}>
                {doc.original_filename}
              </span>

              <div className="flex items-center space-x-1">
                <button
                  id="btn-zoom-out"
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 25))}
                  title="Zoom Out"
                  className="p-1 hover:bg-slate-700 rounded text-slate-300 cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[10px] w-8 text-center">
                  {zoomLevel}%
                </span>
                <button
                  id="btn-zoom-in"
                  onClick={() => setZoomLevel((z) => Math.min(250, z + 25))}
                  title="Zoom In"
                  className="p-1 hover:bg-slate-700 rounded text-slate-300 cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  id="btn-rotate"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  title="Rotate 90°"
                  className="p-1 hover:bg-slate-700 rounded text-slate-300 ml-1 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open file in new tab"
                  className="p-1 hover:bg-slate-700 rounded text-slate-300 ml-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Document Content Canvas/Frame */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/70">
              {isPdf ? (
                <iframe
                  src={fileUrl}
                  title="PDF Preview"
                  className="w-full h-full min-h-[420px] rounded border border-slate-800 bg-white"
                />
              ) : (
                <div
                  className="transition-transform duration-100 ease-out origin-center"
                  style={{
                    transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                  }}
                >
                  <img
                    src={fileUrl}
                    alt="Source operational document"
                    className="max-w-full max-h-[580px] object-contain rounded shadow-lg bg-white"
                  />
                </div>
              )}
            </div>

            {/* Storage Lineage Info Footer */}
            <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="font-mono text-[10px] truncate max-w-[260px]">
                Path: {doc.storage_path}
              </span>
              <span className="text-slate-500 font-medium">Source Evidence</span>
            </div>
          </div>

          {/* Right Column: Editable Fields & Approval Panel (7 cols) */}
          <div className="lg:col-span-7 flex flex-col h-full bg-white overflow-y-auto">
            <div className="p-6 space-y-6 flex-1">
              {/* Document Type Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Classified Document Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedType('fuel_slip')}
                    className={`flex items-center justify-center space-x-2 p-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                      selectedType === 'fuel_slip'
                        ? 'border-amber-500 bg-amber-50/80 text-amber-900 ring-1 ring-amber-500'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Fuel className="w-4 h-4 text-amber-600" />
                    <span>Fuel Slip</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedType('loading_slip')}
                    className={`flex items-center justify-center space-x-2 p-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                      selectedType === 'loading_slip'
                        ? 'border-blue-500 bg-blue-50/80 text-blue-900 ring-1 ring-blue-500'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Scale className="w-4 h-4 text-blue-600" />
                    <span>Loading Slip</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedType('pod')}
                    className={`flex items-center justify-center space-x-2 p-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                      selectedType === 'pod'
                        ? 'border-emerald-500 bg-emerald-50/80 text-emerald-900 ring-1 ring-emerald-500'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                    <span>Proof of Delivery</span>
                  </button>
                </div>
              </div>

              {/* Strict Notice banner */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg flex items-start space-x-2.5 text-xs text-amber-800">
                <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-semibold">Review Rule: </span>
                  Fields left blank or not visible on the original document are marked as{' '}
                  <span className="font-bold text-amber-900">"Not found"</span>. You can correct or input any missing value before approving.
                </div>
              </div>

              {/* Deep Slip AI Re-Scan Card */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-indigo-950">
                      AI Slip Recognition & Deep Re-Scan
                    </span>
                  </div>
                  {onReExtract && (
                    <button
                      type="button"
                      onClick={() => setShowHintInput(!showHintInput)}
                      className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
                    >
                      {showHintInput ? 'Cancel Hint' : '+ Add Operator Hint'}
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                  If thermal paper fading or low contrast caused any numbers to be missed, Gemini 2.5 Flash can re-scan with specialized thermal-OCR filters.
                </p>

                {showHintInput && (
                  <div className="pt-1">
                    <input
                      type="text"
                      value={operatorHint}
                      onChange={(e) => setOperatorHint(e.target.value)}
                      placeholder="e.g. Puma Energy slip, Total is 14250.00, or Reg is CA 889-102"
                      className="w-full text-xs px-3 py-1.5 bg-white border border-indigo-300 rounded-md focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                    />
                  </div>
                )}

                {onReExtract && (
                  <button
                    type="button"
                    disabled={isReExtracting}
                    onClick={handleTriggerReExtract}
                    className="w-full inline-flex items-center justify-center space-x-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isReExtracting ? 'animate-spin' : ''}`} />
                    <span>{isReExtracting ? 'Re-Scanning Document with Gemini...' : 'Re-Scan Slip with Gemini AI'}</span>
                  </button>
                )}
              </div>

              {/* Dynamic Field Form according to selectedType */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Extracted Operational Fields
                  </h3>
                  {hasEdits && (
                    <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      Unsaved human corrections
                    </span>
                  )}
                </div>

                {/* 1. Fuel Slip Fields */}
                {selectedType === 'fuel_slip' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Vehicle Registration */}
                    <div>
                      <FieldLabel label="Vehicle Registration" value={formData.vehicle_registration} />
                      <input
                        type="text"
                        value={formData.vehicle_registration || ''}
                        placeholder="e.g. ABC 123 GP"
                        onChange={(e) => handleFieldChange('vehicle_registration', e.target.value)}
                        className="w-full text-xs font-mono font-semibold px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Supplier */}
                    <div>
                      <FieldLabel label="Supplier / Depot" value={formData.supplier} />
                      <input
                        type="text"
                        value={formData.supplier || ''}
                        placeholder="e.g. Puma Energy, Engen"
                        onChange={(e) => handleFieldChange('supplier', e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Transaction Number */}
                    <div>
                      <FieldLabel label="Transaction Number" value={formData.transaction_number} />
                      <input
                        type="text"
                        value={formData.transaction_number || ''}
                        placeholder="e.g. TXN-892401"
                        onChange={(e) => handleFieldChange('transaction_number', e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Driver Name */}
                    <div>
                      <FieldLabel label="Driver Name" value={formData.driver_name} />
                      <input
                        type="text"
                        value={formData.driver_name || ''}
                        placeholder="Driver name if visible"
                        onChange={(e) => handleFieldChange('driver_name', e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Transaction Date */}
                    <div>
                      <FieldLabel label="Date (YYYY-MM-DD)" value={formData.transaction_date} />
                      <input
                        type="date"
                        value={formData.transaction_date || ''}
                        onChange={(e) => handleFieldChange('transaction_date', e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Transaction Time */}
                    <div>
                      <FieldLabel label="Time (HH:MM)" value={formData.transaction_time} />
                      <input
                        type="text"
                        value={formData.transaction_time || ''}
                        placeholder="HH:MM"
                        onChange={(e) => handleFieldChange('transaction_time', e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Fuel Litres */}
                    <div>
                      <FieldLabel label="Fuel Litres" value={formData.fuel_litres} />
                      <input
                        type="number"
                        step="0.01"
                        value={formData.fuel_litres || ''}
                        placeholder="e.g. 450.50"
                        onChange={(e) => handleFieldChange('fuel_litres', e.target.value)}
                        className="w-full text-xs font-mono font-semibold px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Price Per Litre */}
                    <div>
                      <FieldLabel label="Price Per Litre" value={formData.fuel_price_per_litre} />
                      <input
                        type="number"
                        step="0.001"
                        value={formData.fuel_price_per_litre || ''}
                        placeholder="e.g. 22.45"
                        onChange={(e) => handleFieldChange('fuel_price_per_litre', e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                      {formData.fuel_litres && formData.fuel_total_amount && (
                        <button
                          type="button"
                          onClick={handleCalcRate}
                          className="mt-1 inline-flex items-center space-x-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          <Calculator className="w-3 h-3" />
                          <span>
                            Auto-calc Rate: {(parseFloat(formData.fuel_total_amount) / parseFloat(formData.fuel_litres)).toFixed(3)}/L
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Total Amount */}
                    <div>
                      <FieldLabel label="Total Amount" value={formData.fuel_total_amount} />
                      <input
                        type="number"
                        step="0.01"
                        value={formData.fuel_total_amount || ''}
                        placeholder="e.g. 10113.73"
                        onChange={(e) => handleFieldChange('fuel_total_amount', e.target.value)}
                        className="w-full text-xs font-mono font-bold text-slate-900 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                      {formData.fuel_litres && formData.fuel_price_per_litre && (
                        <button
                          type="button"
                          onClick={handleCalcTotal}
                          className="mt-1 inline-flex items-center space-x-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          <Calculator className="w-3 h-3" />
                          <span>
                            Auto-calc Total: {(parseFloat(formData.fuel_litres) * parseFloat(formData.fuel_price_per_litre)).toFixed(2)}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Odometer */}
                    <div>
                      <FieldLabel label="Odometer (KM)" value={formData.odometer} />
                      <input
                        type="number"
                        step="0.1"
                        value={formData.odometer || ''}
                        placeholder="e.g. 248190"
                        onChange={(e) => handleFieldChange('odometer', e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* 2. Loading Slip Fields */}
                {selectedType === 'loading_slip' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Vehicle Registration */}
                    <div>
                      <FieldLabel label="Vehicle Registration" value={formData.vehicle_registration} />
                      <input
                        type="text"
                        value={formData.vehicle_registration || ''}
                        placeholder="e.g. ABC 123 GP"
                        onChange={(e) => handleFieldChange('vehicle_registration', e.target.value)}
                        className="w-full text-xs font-mono font-semibold px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Load Number */}
                    <div>
                      <FieldLabel label="Load Number" value={formData.load_number} />
                      <input
                        type="text"
                        value={formData.load_number || ''}
                        placeholder="e.g. LOAD-001"
                        onChange={(e) => handleFieldChange('load_number', e.target.value)}
                        className="w-full text-xs font-mono font-bold text-blue-800 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Mine */}
                    <div>
                      <FieldLabel label="Mine / Pit" value={formData.mine} />
                      <input
                        type="text"
                        value={formData.mine || ''}
                        placeholder="e.g. Mafube Colliery"
                        onChange={(e) => handleFieldChange('mine', e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Loading Location */}
                    <div>
                      <FieldLabel label="Loading Location / Silo" value={formData.loading_location} />
                      <input
                        type="text"
                        value={formData.loading_location || ''}
                        placeholder="e.g. Silo 3 Dispatch Bay"
                        onChange={(e) => handleFieldChange('loading_location', e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Product */}
                    <div>
                      <FieldLabel label="Product / Commodity" value={formData.product} />
                      <input
                        type="text"
                        value={formData.product || ''}
                        placeholder="e.g. Thermal Coal RB1, Chrome"
                        onChange={(e) => handleFieldChange('product', e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Quantity Tons */}
                    <div>
                      <FieldLabel label="Quantity (Tons)" value={formData.quantity_tons} />
                      <input
                        type="number"
                        step="0.001"
                        value={formData.quantity_tons || ''}
                        placeholder="e.g. 34.250"
                        onChange={(e) => handleFieldChange('quantity_tons', e.target.value)}
                        className="w-full text-xs font-mono font-bold text-slate-900 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                      {formData.quantity_tons && parseFloat(formData.quantity_tons) > 500 && (
                        <button
                          type="button"
                          onClick={handleConvertKgToTons}
                          className="mt-1 inline-flex items-center space-x-1 text-[11px] font-semibold text-amber-700 hover:text-amber-900 cursor-pointer"
                        >
                          <Scale className="w-3 h-3" />
                          <span>KG detected! Convert to {(parseFloat(formData.quantity_tons) / 1000).toFixed(3)} Tons</span>
                        </button>
                      )}
                    </div>

                    {/* Loading Date */}
                    <div>
                      <FieldLabel label="Loading Date" value={formData.loading_date} />
                      <input
                        type="date"
                        value={formData.loading_date || ''}
                        onChange={(e) => handleFieldChange('loading_date', e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Loading Time */}
                    <div>
                      <FieldLabel label="Loading Time" value={formData.loading_time} />
                      <input
                        type="text"
                        value={formData.loading_time || ''}
                        placeholder="HH:MM"
                        onChange={(e) => handleFieldChange('loading_time', e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Driver Name */}
                    <div>
                      <FieldLabel label="Driver Name" value={formData.driver_name} />
                      <input
                        type="text"
                        value={formData.driver_name || ''}
                        placeholder="Driver name if printed"
                        onChange={(e) => handleFieldChange('driver_name', e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* 3. POD Fields */}
                {selectedType === 'pod' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Vehicle Registration */}
                    <div>
                      <FieldLabel label="Vehicle Registration" value={formData.vehicle_registration} />
                      <input
                        type="text"
                        value={formData.vehicle_registration || ''}
                        placeholder="e.g. ABC 123 GP"
                        onChange={(e) => handleFieldChange('vehicle_registration', e.target.value)}
                        className="w-full text-xs font-mono font-semibold px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Load Number */}
                    <div>
                      <FieldLabel label="Load Number" value={formData.load_number} />
                      <input
                        type="text"
                        value={formData.load_number || ''}
                        placeholder="e.g. LOAD-001"
                        onChange={(e) => handleFieldChange('load_number', e.target.value)}
                        className="w-full text-xs font-mono font-bold text-emerald-800 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Customer */}
                    <div>
                      <FieldLabel label="Customer / Consignee" value={formData.customer} />
                      <input
                        type="text"
                        value={formData.customer || ''}
                        placeholder="e.g. Richards Bay Coal Terminal"
                        onChange={(e) => handleFieldChange('customer', e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Destination */}
                    <div>
                      <FieldLabel label="Destination / Discharge Port" value={formData.destination} />
                      <input
                        type="text"
                        value={formData.destination || ''}
                        placeholder="e.g. Berth 3 Stockyard"
                        onChange={(e) => handleFieldChange('destination', e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Product */}
                    <div>
                      <FieldLabel label="Product" value={formData.product} />
                      <input
                        type="text"
                        value={formData.product || ''}
                        placeholder="e.g. Thermal Coal RB1"
                        onChange={(e) => handleFieldChange('product', e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Quantity Delivered (Tons) */}
                    <div>
                      <FieldLabel label="Quantity Delivered (Tons)" value={formData.quantity_tons} />
                      <input
                        type="number"
                        step="0.001"
                        value={formData.quantity_tons || ''}
                        placeholder="e.g. 34.250"
                        onChange={(e) => handleFieldChange('quantity_tons', e.target.value)}
                        className="w-full text-xs font-mono font-bold text-slate-900 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                      {formData.quantity_tons && parseFloat(formData.quantity_tons) > 500 && (
                        <button
                          type="button"
                          onClick={handleConvertKgToTons}
                          className="mt-1 inline-flex items-center space-x-1 text-[11px] font-semibold text-amber-700 hover:text-amber-900 cursor-pointer"
                        >
                          <Scale className="w-3 h-3" />
                          <span>KG detected! Convert to {(parseFloat(formData.quantity_tons) / 1000).toFixed(3)} Tons</span>
                        </button>
                      )}
                    </div>

                    {/* Delivery Date */}
                    <div>
                      <FieldLabel label="Delivery Date" value={formData.delivery_date} />
                      <input
                        type="date"
                        value={formData.delivery_date || ''}
                        onChange={(e) => handleFieldChange('delivery_date', e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Delivery Time */}
                    <div>
                      <FieldLabel label="Delivery Time" value={formData.delivery_time} />
                      <input
                        type="text"
                        value={formData.delivery_time || ''}
                        placeholder="HH:MM"
                        onChange={(e) => handleFieldChange('delivery_time', e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Received By */}
                    <div>
                      <FieldLabel label="Received By" value={formData.received_by} />
                      <input
                        type="text"
                        value={formData.received_by || ''}
                        placeholder="Receiving officer name"
                        onChange={(e) => handleFieldChange('received_by', e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Signature Present */}
                    <div>
                      <FieldLabel
                        label="Physical Signature Present?"
                        value={formData.signature_present}
                      />
                      <select
                        value={formData.signature_present || ''}
                        onChange={(e) => handleFieldChange('signature_present', e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 font-medium"
                      >
                        <option value="">Not Verified</option>
                        <option value="true">Yes — Signed / Stamped</option>
                        <option value="false">No — Unsigned</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Bottom Operational Action Buttons */}
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
              {isConfirmingReject ? (
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-rose-800">
                    Confirm rejection?
                  </span>
                  <button
                    id="btn-confirm-reject-yes"
                    type="button"
                    onClick={handleReject}
                    disabled={isSubmitting}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Yes, Reject
                  </button>
                  <button
                    id="btn-confirm-reject-cancel"
                    type="button"
                    onClick={() => setIsConfirmingReject(false)}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  id="btn-reject-document"
                  type="button"
                  onClick={handleReject}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-lg border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Ban className="w-4 h-4 text-rose-600" />
                  <span>Reject Document</span>
                </button>
              )}

              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
                {/* Save Corrections Button */}
                <button
                  id="btn-save-corrections"
                  type="button"
                  onClick={handleSaveCorrections}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4 text-slate-600" />
                  <span>Save Corrections</span>
                </button>

                {/* Approve Button */}
                <button
                  id="btn-approve-document"
                  type="button"
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {hasEdits ? 'Approve with Corrections' : 'Approve & Save to Database'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function FieldLabel({ label, value }: { label: string; value: any }) {
  const isNotFound = value === null || value === undefined || value === '';

  return (
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      {isNotFound ? (
        <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
          Not found
        </span>
      ) : (
        <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium flex items-center space-x-0.5">
          <Sparkles className="w-2.5 h-2.5" />
          <span>Extracted</span>
        </span>
      )}
    </div>
  );
}
