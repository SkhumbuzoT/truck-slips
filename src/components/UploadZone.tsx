import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, AlertCircle, Sparkles, Fuel, Scale, FileCheck2, Loader2, Image as ImageIcon } from 'lucide-react';
import { createSampleDocumentFile } from '../lib/sample-docs';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
  processingQueueLength: number;
}

const ALLOWED_EXTENSIONS = [
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
];

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFilesSelected,
  isProcessing,
  processingQueueLength,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndHandleFiles = (fileList: FileList | File[]) => {
    setValidationError(null);
    const validFiles: File[] = [];
    const files = Array.from(fileList);

    for (const file of files) {
      const mime = file.type.toLowerCase();
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();

      // Accept any image MIME type, PDF, or allowed extension
      const isAllowed =
        mime.startsWith('image/') ||
        mime === 'application/pdf' ||
        mime === 'application/octet-stream' ||
        mime === '' ||
        ALLOWED_EXTENSIONS.includes(ext);

      if (!isAllowed) {
        setValidationError(
          `File "${file.name}" has an unsupported format. Please upload JPG, PNG, WEBP, HEIC, or PDF.`
        );
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setValidationError(
          `File "${file.name}" exceeds the 50MB operational limit.`
        );
        return;
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndHandleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndHandleFiles(e.target.files);
      // Reset input value so identical file can be selected again if needed
      e.target.value = '';
    }
  };

  const triggerSample = (type: 'fuel_slip' | 'loading_slip' | 'pod') => {
    const sampleFile = createSampleDocumentFile(type);
    validateAndHandleFiles([sampleFile]);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
          Document Ingestion
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Upload and process fuel receipts, loading slips, and signed proof of delivery documents.
        </p>
      </div>

      {/* Main Drop Area */}
      <div
        id="drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-150 overflow-hidden ${
          isDragOver
            ? 'border-blue-600 bg-blue-50/40'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
        }`}
      >
        {/* Full-bleed transparent native file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.heic,.heif,.jfif,.webp,.png,.jpg,.jpeg,.bmp,.tiff,.tif"
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          id="file-input"
          aria-label="Upload document images or PDFs"
        />

        <div className="flex flex-col items-center justify-center space-y-2.5 pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-600">
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            ) : (
              <UploadCloud className="w-5 h-5 text-slate-600" />
            )}
          </div>

          <div className="space-y-0.5">
            <p className="text-sm font-medium text-slate-900">
              {isProcessing
                ? `Processing document queue (${processingQueueLength} remaining)...`
                : 'Click to select documents or drag & drop files here'}
            </p>
            <p className="text-xs text-slate-500">
              Supported: JPG, PNG, WEBP, HEIC, PDF (up to 50MB per file)
            </p>
          </div>

          <div className="pt-1">
            <span
              id="btn-browse-visual"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Select Files</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1 text-[11px] text-slate-500">
            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">Fuel Slips</span>
            <span>•</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">Weighbridge Slips</span>
            <span>•</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">Proof of Delivery (POD)</span>
          </div>
        </div>
      </div>

      {/* Validation Error Alert */}
      {validationError && (
        <div className="mt-3 p-2.5 rounded bg-rose-50 border border-rose-200 flex items-center space-x-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Quick Load Realistic Trucking Sample Documents */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="text-xs text-slate-500">
          <span className="font-medium text-slate-700">Sample Documents: </span>
          <span>Load mock slips for quick testing</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            id="btn-sample-fuel"
            onClick={(e) => {
              e.stopPropagation();
              triggerSample('fuel_slip');
            }}
            disabled={isProcessing}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Fuel className="w-3 h-3 text-slate-600" />
            <span>Fuel Slip</span>
          </button>

          <button
            id="btn-sample-loading"
            onClick={(e) => {
              e.stopPropagation();
              triggerSample('loading_slip');
            }}
            disabled={isProcessing}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Scale className="w-3 h-3 text-slate-600" />
            <span>Loading Slip</span>
          </button>

          <button
            id="btn-sample-pod"
            onClick={(e) => {
              e.stopPropagation();
              triggerSample('pod');
            }}
            disabled={isProcessing}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <FileCheck2 className="w-3 h-3 text-slate-600" />
            <span>POD</span>
          </button>
        </div>
      </div>
    </div>
  );
};
