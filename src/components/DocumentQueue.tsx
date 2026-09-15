import React, { useState } from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Filter,
  Eye,
  Fuel,
  Scale,
  FileCheck2,
  HelpCircle,
  FileEdit,
} from 'lucide-react';
import { DocumentRecord, DocumentType, ProcessingStatus } from '../types';

interface DocumentQueueProps {
  documents: DocumentRecord[];
  onSelectDocumentForReview: (doc: DocumentRecord) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const DocumentQueue: React.FC<DocumentQueueProps> = ({
  documents,
  onSelectDocumentForReview,
  onRefresh,
  isRefreshing,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredDocs = documents.filter((doc) => {
    if (filterType !== 'all' && doc.document_type !== filterType) return false;
    if (filterStatus !== 'all' && doc.processing_status !== filterStatus) return false;
    return true;
  });

  const getDocTypeBadge = (type: DocumentType) => {
    switch (type) {
      case 'fuel_slip':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
            <Fuel className="w-3 h-3 text-slate-600" />
            <span>Fuel Slip</span>
          </span>
        );
      case 'loading_slip':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
            <Scale className="w-3 h-3 text-slate-600" />
            <span>Loading Slip</span>
          </span>
        );
      case 'pod':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
            <FileCheck2 className="w-3 h-3 text-slate-600" />
            <span>POD</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <HelpCircle className="w-3 h-3 text-slate-400" />
            <span>Unclassified</span>
          </span>
        );
    }
  };

  const getStatusBadge = (status: ProcessingStatus) => {
    switch (status) {
      case 'review_required':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>Pending Review</span>
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Approved</span>
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3 text-blue-600 animate-spin" />
            <span>Processing</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>Rejected</span>
          </span>
        );
      case 'uploaded':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <span>Uploaded</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <span>{status}</span>
          </span>
        );
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const getVehicleReg = (doc: DocumentRecord) => {
    const raw =
      doc.extraction_review?.reviewed_data?.vehicle_registration ||
      doc.extraction_review?.ai_extraction?.fuel_slip_data?.vehicle_registration ||
      doc.extraction_review?.ai_extraction?.loading_slip_data?.vehicle_registration ||
      doc.extraction_review?.ai_extraction?.pod_data?.vehicle_registration;
    return raw ? String(raw) : null;
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden mt-6">
      {/* Header & Filter Controls */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Documents
          </h3>
          <span className="px-2 py-0.2 rounded-full bg-slate-200 text-slate-700 text-xs font-medium">
            {documents.length}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Filter by Type */}
          <div className="flex items-center space-x-1 text-xs">
            <Filter className="w-3 h-3 text-slate-400" />
            <select
              id="select-filter-type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              aria-label="Filter documents by document type"
              className="bg-white border border-slate-300 text-slate-700 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-slate-500"
            >
              <option value="all">All Types</option>
              <option value="fuel_slip">Fuel Slips</option>
              <option value="loading_slip">Loading Slips</option>
              <option value="pod">Proof of Delivery</option>
            </select>
          </div>

          {/* Filter by Status */}
          <select
            id="select-filter-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter documents by processing status"
            className="bg-white border border-slate-300 text-slate-700 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-slate-500"
          >
            <option value="all">All Statuses</option>
            <option value="review_required">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="processing">Processing</option>
            <option value="failed">Rejected</option>
          </select>

          <button
            id="btn-refresh-queue"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 rounded text-xs font-medium text-slate-700 cursor-pointer disabled:opacity-50"
          >
            {isRefreshing ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Documents Table */}
      {filteredDocs.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-700">No documents</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Uploaded slips will appear in this list.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Document</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredDocs.map((doc) => {
                const isReviewRequired = doc.processing_status === 'review_required';
                const vehicleReg = getVehicleReg(doc);

                return (
                  <tr
                    key={doc.id}
                    id={`doc-row-${doc.id}`}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    {/* Document File & Size */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2.5">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate max-w-xs" title={doc.original_filename}>
                            {doc.original_filename}
                          </p>
                          <span className="text-[11px] text-slate-500">
                            {formatFileSize(doc.file_size)}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Vehicle Registration */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {vehicleReg ? (
                        <span className="font-mono font-medium text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {vehicleReg}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">—</span>
                      )}
                    </td>

                    {/* Classified Type */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getDocTypeBadge(doc.document_type)}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(doc.processing_status)}
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      {formatDate(doc.uploaded_at)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      {isReviewRequired ? (
                        <button
                          id={`btn-review-${doc.id}`}
                          onClick={() => onSelectDocumentForReview(doc)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-colors cursor-pointer"
                        >
                          <FileEdit className="w-3.5 h-3.5" />
                          <span>Review</span>
                        </button>
                      ) : (
                        <button
                          id={`btn-view-${doc.id}`}
                          onClick={() => onSelectDocumentForReview(doc)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>View</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
