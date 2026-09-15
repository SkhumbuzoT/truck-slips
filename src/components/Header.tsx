import React from 'react';
import { Truck, Database } from 'lucide-react';
import { SystemStatus } from '../types';

interface HeaderProps {
  status: SystemStatus | null;
  onOpenSupabaseModal: () => void;
  documentCount: number;
  reviewRequiredCount: number;
  approvedCount: number;
  activeView: 'capture' | 'ledger';
  setActiveView: (view: 'capture' | 'ledger') => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  onOpenSupabaseModal,
  reviewRequiredCount,
  approvedCount,
  activeView,
  setActiveView,
}) => {
  const needsMigration = status?.supabaseConfigured && !status?.tablesReady;

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Identity */}
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center text-white">
                <Truck className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <span className="text-base font-bold text-slate-900 tracking-tight">
                  PRIMECHAIN
                </span>
                <span className="text-slate-400 font-light mx-1.5">|</span>
                <span className="text-xs text-slate-500 font-medium">
                  Fleet Operations
                </span>
              </div>
            </div>

            {/* Enterprise Navigation Links */}
            <nav className="hidden md:flex items-center space-x-6">
              <button
                id="tab-capture-pipeline"
                onClick={() => setActiveView('capture')}
                className={`py-5 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 cursor-pointer ${
                  activeView === 'capture'
                    ? 'border-slate-900 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <span>Documents</span>
                {reviewRequiredCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-900">
                    {reviewRequiredCount} pending
                  </span>
                )}
              </button>

              <button
                id="tab-operational-ledger"
                onClick={() => setActiveView('ledger')}
                className={`py-5 text-sm font-medium border-b-2 transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeView === 'ledger'
                    ? 'border-slate-900 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <span>Fleet Ledger</span>
                {approvedCount > 0 && (
                  <span className="text-xs text-slate-400 font-normal">
                    ({approvedCount})
                  </span>
                )}
              </button>
            </nav>
          </div>

          {/* Right Action: Clean Database Settings icon button */}
          <div className="flex items-center space-x-2">
            <button
              id="btn-supabase-status"
              onClick={onOpenSupabaseModal}
              title="Database & Storage Settings"
              className={`relative p-2 rounded-md transition-colors cursor-pointer border ${
                needsMigration
                  ? 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'
                  : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Database className="w-4 h-4" />
              {needsMigration && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="flex md:hidden border-t border-slate-100 py-2 space-x-4">
          <button
            onClick={() => setActiveView('capture')}
            className={`flex-1 py-1.5 text-xs font-semibold text-center rounded ${
              activeView === 'capture'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Documents {reviewRequiredCount > 0 ? `(${reviewRequiredCount})` : ''}
          </button>
          <button
            onClick={() => setActiveView('ledger')}
            className={`flex-1 py-1.5 text-xs font-semibold text-center rounded ${
              activeView === 'ledger'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Fleet Ledger {approvedCount > 0 ? `(${approvedCount})` : ''}
          </button>
        </div>
      </div>
    </header>
  );
};
