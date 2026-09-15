import React, { useState } from 'react';
import {
  Layers,
  Fuel,
  Scale,
  FileCheck2,
  GitMerge,
  Search,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { DocumentRecord, FuelRecord, LoadingRecord, PodRecord } from '../types';

interface OperationalLedgerProps {
  documents: DocumentRecord[];
  onOpenDocumentReview: (doc: DocumentRecord) => void;
}

export const OperationalLedger: React.FC<OperationalLedgerProps> = ({
  documents,
  onOpenDocumentReview,
}) => {
  const [activeTab, setActiveTab] = useState<'lineage' | 'fuel' | 'loading' | 'pod' | 'audit'>(
    'lineage'
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Extract approved operational records
  const approvedDocs = documents.filter((d) => d.processing_status === 'approved');

  const fuelRecords: (FuelRecord & { doc?: DocumentRecord })[] = [];
  const loadingRecords: (LoadingRecord & { doc?: DocumentRecord })[] = [];
  const podRecords: (PodRecord & { doc?: DocumentRecord })[] = [];

  approvedDocs.forEach((doc) => {
    if (doc.document_type === 'fuel_slip' && doc.operational_record) {
      fuelRecords.push({ ...(doc.operational_record as FuelRecord), doc });
    } else if (doc.document_type === 'loading_slip' && doc.operational_record) {
      loadingRecords.push({ ...(doc.operational_record as LoadingRecord), doc });
    } else if (doc.document_type === 'pod' && doc.operational_record) {
      podRecords.push({ ...(doc.operational_record as PodRecord), doc });
    }
  });

  // Group linked fleet operations by Vehicle Registration & Load Number
  interface UnifiedTrip {
    vehicleRegistration: string;
    loadNumber?: string;
    fuelSlip?: FuelRecord & { doc?: DocumentRecord };
    loadingSlip?: LoadingRecord & { doc?: DocumentRecord };
    pod?: PodRecord & { doc?: DocumentRecord };
    date?: string;
  }

  const tripsMap = new Map<string, UnifiedTrip>();

  // Helper to construct grouping key
  loadingRecords.forEach((l) => {
    const key = (l.vehicle_registration || 'UNKNOWN_VEHICLE') + '::' + (l.load_number || 'UNKNOWN_LOAD');
    if (!tripsMap.has(key)) {
      tripsMap.set(key, {
        vehicleRegistration: l.vehicle_registration || 'Unspecified',
        loadNumber: l.load_number || undefined,
        loadingSlip: l,
        date: l.loading_date || undefined,
      });
    } else {
      tripsMap.get(key)!.loadingSlip = l;
    }
  });

  podRecords.forEach((p) => {
    const key = (p.vehicle_registration || 'UNKNOWN_VEHICLE') + '::' + (p.load_number || 'UNKNOWN_LOAD');
    if (!tripsMap.has(key)) {
      tripsMap.set(key, {
        vehicleRegistration: p.vehicle_registration || 'Unspecified',
        loadNumber: p.load_number || undefined,
        pod: p,
        date: p.delivery_date || undefined,
      });
    } else {
      tripsMap.get(key)!.pod = p;
    }
  });

  fuelRecords.forEach((f) => {
    // Try matching existing trip by vehicle registration
    let matched = false;
    for (const [, trip] of tripsMap.entries()) {
      if (
        f.vehicle_registration &&
        trip.vehicleRegistration.replace(/\s+/g, '').toUpperCase() ===
          f.vehicle_registration.replace(/\s+/g, '').toUpperCase()
      ) {
        trip.fuelSlip = f;
        matched = true;
        break;
      }
    }

    if (!matched) {
      const key = (f.vehicle_registration || 'UNKNOWN_VEHICLE') + '::FUEL_' + f.id.slice(0, 4);
      tripsMap.set(key, {
        vehicleRegistration: f.vehicle_registration || 'Unspecified',
        fuelSlip: f,
        date: f.transaction_date || undefined,
      });
    }
  });

  const trips = Array.from(tripsMap.values()).filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.vehicleRegistration.toLowerCase().includes(q) ||
      (t.loadNumber && t.loadNumber.toLowerCase().includes(q))
    );
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs mt-6 overflow-hidden">
      {/* Tab Navigation */}
      <div className="border-b border-slate-200 p-4 sm:p-5 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Operational Fleet Ledger & Document Lineage
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational database linking Fuel Slips, Mine Loading Slips, and Destination PODs by vehicle and load keys.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Vehicle or Load #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 px-4 flex space-x-1 overflow-x-auto bg-slate-50">
        <button
          onClick={() => setActiveTab('lineage')}
          className={`flex items-center space-x-1.5 py-2.5 px-3 border-b-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === 'lineage'
              ? 'border-blue-600 text-blue-600 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <GitMerge className="w-3.5 h-3.5 text-blue-600" />
          <span>Trip Lineage & Cross-Links ({trips.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('fuel')}
          className={`flex items-center space-x-1.5 py-2.5 px-3 border-b-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === 'fuel'
              ? 'border-amber-600 text-amber-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Fuel className="w-3.5 h-3.5 text-amber-600" />
          <span>Fuel Records ({fuelRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('loading')}
          className={`flex items-center space-x-1.5 py-2.5 px-3 border-b-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === 'loading'
              ? 'border-blue-600 text-blue-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Scale className="w-3.5 h-3.5 text-blue-600" />
          <span>Loading Records ({loadingRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pod')}
          className={`flex items-center space-x-1.5 py-2.5 px-3 border-b-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === 'pod'
              ? 'border-emerald-600 text-emerald-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>POD Records ({podRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center space-x-1.5 py-2.5 px-3 border-b-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === 'audit'
              ? 'border-purple-600 text-purple-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span>AI Audit (AI vs Human Corrections)</span>
        </button>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* 1. Trip Lineage View */}
        {activeTab === 'lineage' && (
          <div>
            <div className="mb-4 p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center space-x-2">
              <GitMerge className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong>Operational Lineage Engine: </strong> Documents are automatically linked by common keys (Vehicle Registration & Load Number) into a single operational audit picture.
              </span>
            </div>

            {trips.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <p className="text-sm font-semibold">No approved trip records yet.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Upload and approve documents from the Capture tab to establish operational links.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {trips.map((trip, idx) => {
                  const hasAllThree = trip.fuelSlip && trip.loadingSlip && trip.pod;
                  return (
                    <div
                      key={idx}
                      className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-all bg-slate-50/30"
                    >
                      {/* Trip Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                        <div className="flex items-center space-x-3">
                          <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-slate-900 text-white font-mono">
                            Vehicle: {trip.vehicleRegistration}
                          </span>
                          {trip.loadNumber && (
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                              Load #{trip.loadNumber}
                            </span>
                          )}
                          {trip.date && (
                            <span className="text-xs text-slate-500 font-medium">
                              Date: {trip.date}
                            </span>
                          )}
                        </div>

                        <div>
                          {hasAllThree ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Complete Trip Lineage (100%)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              <span>In-Progress Journey</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Lineage Visual Cards: Fuel Slip -> Loading Slip -> POD */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                        {/* 1. Fuel Slip Node */}
                        <div
                          className={`rounded-lg border p-3.5 text-xs ${
                            trip.fuelSlip
                              ? 'bg-amber-50/40 border-amber-200'
                              : 'bg-slate-100/60 border-dashed border-slate-300 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-amber-900 flex items-center space-x-1">
                              <Fuel className="w-3.5 h-3.5 text-amber-600" />
                              <span>1. Fuel Slip</span>
                            </span>
                            {trip.fuelSlip && (
                              <button
                                onClick={() => trip.fuelSlip?.doc && onOpenDocumentReview(trip.fuelSlip.doc)}
                                className="text-[11px] text-amber-700 hover:underline flex items-center space-x-0.5"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Evidence</span>
                              </button>
                            )}
                          </div>
                          {trip.fuelSlip ? (
                            <div className="space-y-1 text-slate-700">
                              <p>Supplier: <span className="font-medium">{trip.fuelSlip.supplier || 'N/A'}</span></p>
                              <p>Litres: <span className="font-mono font-semibold">{trip.fuelSlip.fuel_litres ? `${trip.fuelSlip.fuel_litres} L` : 'N/A'}</span></p>
                              <p>Amount: <span className="font-mono font-semibold">{trip.fuelSlip.fuel_total_amount ? `R ${trip.fuelSlip.fuel_total_amount}` : 'N/A'}</span></p>
                              <p>Odometer: <span className="font-mono">{trip.fuelSlip.odometer ? `${trip.fuelSlip.odometer} KM` : 'N/A'}</span></p>
                            </div>
                          ) : (
                            <p className="italic py-3 text-center">No fuel slip linked</p>
                          )}
                        </div>

                        {/* 2. Loading Slip Node */}
                        <div
                          className={`rounded-lg border p-3.5 text-xs ${
                            trip.loadingSlip
                              ? 'bg-blue-50/40 border-blue-200'
                              : 'bg-slate-100/60 border-dashed border-slate-300 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-blue-900 flex items-center space-x-1">
                              <Scale className="w-3.5 h-3.5 text-blue-600" />
                              <span>2. Mine Loading Slip</span>
                            </span>
                            {trip.loadingSlip && (
                              <button
                                onClick={() => trip.loadingSlip?.doc && onOpenDocumentReview(trip.loadingSlip.doc)}
                                className="text-[11px] text-blue-700 hover:underline flex items-center space-x-0.5"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Evidence</span>
                              </button>
                            )}
                          </div>
                          {trip.loadingSlip ? (
                            <div className="space-y-1 text-slate-700">
                              <p>Mine: <span className="font-medium">{trip.loadingSlip.mine || 'N/A'}</span></p>
                              <p>Product: <span className="font-medium">{trip.loadingSlip.product || 'N/A'}</span></p>
                              <p>Quantity: <span className="font-mono font-bold text-slate-900">{trip.loadingSlip.quantity_tons ? `${trip.loadingSlip.quantity_tons} Tons` : 'N/A'}</span></p>
                              <p>Time: <span className="font-mono">{trip.loadingSlip.loading_time || 'N/A'}</span></p>
                            </div>
                          ) : (
                            <p className="italic py-3 text-center">No loading slip linked</p>
                          )}
                        </div>

                        {/* 3. POD Node */}
                        <div
                          className={`rounded-lg border p-3.5 text-xs ${
                            trip.pod
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : 'bg-slate-100/60 border-dashed border-slate-300 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-emerald-900 flex items-center space-x-1">
                              <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>3. Signed POD</span>
                            </span>
                            {trip.pod && (
                              <button
                                onClick={() => trip.pod?.doc && onOpenDocumentReview(trip.pod.doc)}
                                className="text-[11px] text-emerald-700 hover:underline flex items-center space-x-0.5"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Evidence</span>
                              </button>
                            )}
                          </div>
                          {trip.pod ? (
                            <div className="space-y-1 text-slate-700">
                              <p>Customer: <span className="font-medium">{trip.pod.customer || 'N/A'}</span></p>
                              <p>Destination: <span className="font-medium">{trip.pod.destination || 'N/A'}</span></p>
                              <p>Received By: <span className="font-medium">{trip.pod.received_by || 'N/A'}</span></p>
                              <p>
                                Signature:
                                {trip.pod.signature_present ? (
                                  <span className="ml-1 font-bold text-emerald-700">Verified Signed</span>
                                ) : (
                                  <span className="ml-1 text-slate-500">Unsigned</span>
                                )}
                              </p>
                            </div>
                          ) : (
                            <p className="italic py-3 text-center">No POD linked</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. Fuel Records Table */}
        {activeTab === 'fuel' && (
          <div className="overflow-x-auto">
            {fuelRecords.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">No fuel records approved yet.</p>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Vehicle</th>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3">Txn #</th>
                    <th className="py-2.5 px-3">Date / Time</th>
                    <th className="py-2.5 px-3 text-right">Litres</th>
                    <th className="py-2.5 px-3 text-right">Price / L</th>
                    <th className="py-2.5 px-3 text-right">Total Amount</th>
                    <th className="py-2.5 px-3 text-right">Odometer</th>
                    <th className="py-2.5 px-3 text-right">Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {fuelRecords.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {f.vehicle_registration || 'N/A'}
                      </td>
                      <td className="py-2.5 px-3">{f.supplier || 'N/A'}</td>
                      <td className="py-2.5 px-3 font-mono">{f.transaction_number || 'N/A'}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {f.transaction_date || ''} {f.transaction_time || ''}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {f.fuel_litres !== null ? `${f.fuel_litres} L` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {f.fuel_price_per_litre !== null ? `${f.fuel_price_per_litre}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {f.fuel_total_amount !== null ? `R ${f.fuel_total_amount}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {f.odometer !== null ? `${f.odometer} KM` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {f.doc && (
                          <button
                            onClick={() => f.doc && onOpenDocumentReview(f.doc)}
                            className="text-blue-600 hover:underline inline-flex items-center space-x-0.5"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Doc</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 3. Loading Records Table */}
        {activeTab === 'loading' && (
          <div className="overflow-x-auto">
            {loadingRecords.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">No loading records approved yet.</p>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Vehicle</th>
                    <th className="py-2.5 px-3">Load #</th>
                    <th className="py-2.5 px-3">Mine / Location</th>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3 text-right">Quantity (Tons)</th>
                    <th className="py-2.5 px-3">Date / Time</th>
                    <th className="py-2.5 px-3">Driver</th>
                    <th className="py-2.5 px-3 text-right">Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loadingRecords.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {l.vehicle_registration || 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                        {l.load_number || 'N/A'}
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-medium">{l.mine || 'N/A'}</p>
                        <p className="text-[11px] text-slate-400">{l.loading_location || ''}</p>
                      </td>
                      <td className="py-2.5 px-3 font-medium">{l.product || 'N/A'}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {l.quantity_tons !== null ? `${l.quantity_tons} T` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {l.loading_date || ''} {l.loading_time || ''}
                      </td>
                      <td className="py-2.5 px-3">{l.driver_name || 'N/A'}</td>
                      <td className="py-2.5 px-3 text-right">
                        {l.doc && (
                          <button
                            onClick={() => l.doc && onOpenDocumentReview(l.doc)}
                            className="text-blue-600 hover:underline inline-flex items-center space-x-0.5"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Doc</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 4. POD Records Table */}
        {activeTab === 'pod' && (
          <div className="overflow-x-auto">
            {podRecords.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">No POD records approved yet.</p>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Vehicle</th>
                    <th className="py-2.5 px-3">Load #</th>
                    <th className="py-2.5 px-3">Customer / Destination</th>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3 text-right">Delivered Tons</th>
                    <th className="py-2.5 px-3">Date / Time</th>
                    <th className="py-2.5 px-3">Received By</th>
                    <th className="py-2.5 px-3">Signature</th>
                    <th className="py-2.5 px-3 text-right">Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {podRecords.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {p.vehicle_registration || 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                        {p.load_number || 'N/A'}
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-medium">{p.customer || 'N/A'}</p>
                        <p className="text-[11px] text-slate-400">{p.destination || ''}</p>
                      </td>
                      <td className="py-2.5 px-3">{p.product || 'N/A'}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {p.quantity_tons !== null ? `${p.quantity_tons} T` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {p.delivery_date || ''} {p.delivery_time || ''}
                      </td>
                      <td className="py-2.5 px-3">{p.received_by || 'N/A'}</td>
                      <td className="py-2.5 px-3">
                        {p.signature_present ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Signed
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                            Unsigned
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {p.doc && (
                          <button
                            onClick={() => p.doc && onOpenDocumentReview(p.doc)}
                            className="text-blue-600 hover:underline inline-flex items-center space-x-0.5"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Doc</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 5. AI Audit Comparison: AI Extraction vs Human Corrected Value */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg text-xs text-purple-900">
              <strong>Extraction Audit Trail: </strong>
              Comparing raw AI extraction output against human reviewed values to audit accuracy, identify recurring model issues, and continuously improve OCR prompts.
            </div>

            {approvedDocs.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">No reviewed documents yet.</p>
            ) : (
              <div className="space-y-3">
                {approvedDocs.map((doc) => {
                  const rev = doc.extraction_review;
                  if (!rev) return null;

                  return (
                    <div
                      key={doc.id}
                      className="border border-slate-200 rounded-lg p-4 bg-white text-xs space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-slate-600" />
                          <span className="font-semibold text-slate-900">
                            {doc.original_filename}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-100 text-slate-700">
                            {doc.document_type}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rev.review_status === 'corrected'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          Audit Status: {rev.review_status.toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 rounded border border-slate-200 font-mono text-[11px] overflow-x-auto">
                          <p className="font-bold text-slate-700 mb-1">
                            Raw Gemini Extraction (Draft):
                          </p>
                          <pre className="text-slate-600">
                            {JSON.stringify(rev.ai_extraction, null, 2)}
                          </pre>
                        </div>

                        <div className="bg-emerald-50/40 p-3 rounded border border-emerald-200 font-mono text-[11px] overflow-x-auto">
                          <p className="font-bold text-emerald-900 mb-1">
                            Human Verified Operational Record:
                          </p>
                          <pre className="text-slate-700">
                            {JSON.stringify(rev.reviewed_data || doc.operational_record, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
