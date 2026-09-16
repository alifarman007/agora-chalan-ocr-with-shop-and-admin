'use client';

import React from 'react';
import { DeliveryChalanDocument, SummaryField } from '@/types/delivery-chalan';
import ConfidenceBadge from './confidence-badge';
import { Plus, Trash } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SummarySectionProps {
  document: DeliveryChalanDocument;
  onUpdate: (updates: Partial<DeliveryChalanDocument>) => void;
  readOnly?: boolean;
  className?: string;
}

const SummarySection: React.FC<SummarySectionProps> = ({
  document,
  onUpdate,
  readOnly = false,
  className,
}) => {
  const updateSummaryField = (
    id: string,
    field: keyof SummaryField,
    value: string | number,
  ) => {
    const newSummary = document.summary.map((item) =>
      item.id === id ? ({ ...item, [field]: value } as SummaryField) : item,
    );
    onUpdate({ summary: newSummary });
  };

  const removeField = (id: string) => {
    const newSummary = document.summary.filter((item) => item.id !== id);
    onUpdate({ summary: newSummary });
  };

  const addField = () => {
    const newField: SummaryField = {
      id: Math.random().toString(36).substr(2, 9),
      key: 'Total',
      value: '',
      field_type: 'currency',
      confidence: 1.0,
    };
    onUpdate({ summary: [...document.summary, newField] });
  };

  return (
    <div
      className={cn(
        'bg-white dark:bg-neutral-900 rounded-lg border border-slate-200 dark:border-neutral-700 shadow-xs p-4',
        className,
      )}
    >
      <h3 className="text-sm font-semibold text-slate-700 dark:text-neutral-200 mb-4 border-b border-slate-100 dark:border-neutral-800 pb-2">
        Summary &amp; Totals
      </h3>

      <div className="space-y-3">
        {document.summary.map((item) => (
          <div key={item.id} className="flex items-center space-x-3 justify-end">
            <div className="w-1/3">
              <input
                type="text"
                readOnly={readOnly}
                value={item.key || ''}
                onChange={(e) => updateSummaryField(item.id, 'key', e.target.value)}
                className="w-full text-sm font-medium text-slate-600 dark:text-neutral-300 text-right bg-transparent border-none focus:ring-0 placeholder:text-slate-300 dark:placeholder:text-neutral-600 bangla-text"
                placeholder="Label"
              />
            </div>

            <div className="w-1/3">
              <input
                type="text"
                readOnly={readOnly}
                value={item.value || ''}
                onChange={(e) => updateSummaryField(item.id, 'value', e.target.value)}
                className="w-full text-base font-bold text-slate-900 dark:text-neutral-100 dark:bg-transparent border border-slate-200 dark:border-neutral-700 rounded-sm px-2 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-right"
              />
            </div>

            <div className="flex items-center space-x-2">
              <ConfidenceBadge confidence={item.confidence} />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeField(item.id)}
                  className="cursor-pointer text-slate-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  <Trash className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={addField}
            className="cursor-pointer text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center"
          >
            <Plus className="h-3 w-3 mr-1" /> Add Summary Field
          </button>
        </div>
      )}
    </div>
  );
};

export default SummarySection;
