'use client';

import React from 'react';
import { DeliveryChalanDocument } from '@/types/delivery-chalan';
import ConfidenceBadge from './confidence-badge';
import { cn } from '@/lib/cn';

export interface HeaderSectionProps {
  document: DeliveryChalanDocument;
  onUpdate: (updates: Partial<DeliveryChalanDocument>) => void;
  readOnly?: boolean;
  className?: string;
}

const HeaderSection: React.FC<HeaderSectionProps> = ({
  document,
  onUpdate,
  readOnly = false,
  className,
}) => {
  // NOTE: `document.processing_model` is intentionally not displayed — the model name/id is
  // never surfaced in the UI (it stays in the exported JSON). See "Conventions" in CLAUDE.md.
  return (
    <div
      className={cn(
        'bg-white dark:bg-neutral-900 rounded-lg p-6 border border-slate-200 dark:border-neutral-700 shadow-xs mb-6',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 text-xs font-bold uppercase tracking-wide rounded-sm border border-blue-200 dark:border-blue-500/30">
            📦 Delivery Chalan
          </span>
        </div>
        <ConfidenceBadge confidence={document.ai_confidence} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-neutral-400 mb-1">
            CHALAN NO / চালান নং
          </label>
          <input
            type="text"
            readOnly={readOnly}
            className="w-full text-base font-semibold text-slate-900 dark:text-neutral-100 dark:bg-transparent border-b-2 border-slate-200 dark:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-hidden py-1 transition-colors bangla-text"
            value={document.chalan_number || ''}
            onChange={(e) => onUpdate({ chalan_number: e.target.value })}
            placeholder="No chalan no."
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-neutral-400 mb-1">
            PO NO / পি.ও. নং
          </label>
          <input
            type="text"
            readOnly={readOnly}
            className="w-full text-base font-medium text-slate-900 dark:text-neutral-100 dark:bg-transparent border-b-2 border-slate-200 dark:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-hidden py-1 transition-colors bangla-text"
            value={document.po_number || ''}
            onChange={(e) => onUpdate({ po_number: e.target.value })}
            placeholder="No PO no."
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-neutral-400 mb-1">
            DATE / তারিখ
          </label>
          <input
            type="text"
            readOnly={readOnly}
            className="w-full text-base font-medium text-slate-900 dark:text-neutral-100 dark:bg-transparent border-b-2 border-slate-200 dark:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-hidden py-1 transition-colors bangla-text"
            value={document.date || ''}
            onChange={(e) => onUpdate({ date: e.target.value })}
            placeholder="DD/MM/YYYY"
          />
        </div>
      </div>
    </div>
  );
};

export default HeaderSection;
