'use client';

import React from 'react';
import { DeliveryChalanDocument, MetadataField } from '@/types/delivery-chalan';
import ConfidenceBadge from './confidence-badge';
import { Plus, Trash, GripVertical } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface MetadataSectionProps {
  document: DeliveryChalanDocument;
  onUpdate: (updates: Partial<DeliveryChalanDocument>) => void;
  readOnly?: boolean;
  className?: string;
}

const MetadataSection: React.FC<MetadataSectionProps> = ({
  document,
  onUpdate,
  readOnly = false,
  className,
}) => {
  const updateMetadataField = (
    id: string,
    field: keyof MetadataField,
    value: string | number,
  ) => {
    const newMetadata = document.additional_metadata.map((item) =>
      item.id === id ? ({ ...item, [field]: value } as MetadataField) : item,
    );
    onUpdate({ additional_metadata: newMetadata });
  };

  const removeField = (id: string) => {
    const newMetadata = document.additional_metadata.filter((item) => item.id !== id);
    onUpdate({ additional_metadata: newMetadata });
  };

  const addField = () => {
    const newField: MetadataField = {
      id: Math.random().toString(36).substr(2, 9),
      key: 'New Field',
      value: '',
      field_type: 'text',
      confidence: 1.0,
    };
    onUpdate({ additional_metadata: [...document.additional_metadata, newField] });
  };

  return (
    <div
      className={cn(
        'bg-white dark:bg-neutral-900 rounded-lg border border-slate-200 dark:border-neutral-700 shadow-xs mb-6 overflow-hidden',
        className,
      )}
    >
      <div className="bg-slate-50 dark:bg-neutral-800/50 px-4 py-3 border-b border-slate-200 dark:border-neutral-700 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-neutral-200">Additional Metadata</h3>
      </div>

      <div className="p-4">
        {document.additional_metadata.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-neutral-500 italic text-center py-2">
            No additional fields found.
          </p>
        )}

        <div className="space-y-3">
          {document.additional_metadata.map((item) => (
            <div key={item.id} className="flex items-center space-x-3 group">
              <GripVertical className="h-4 w-4 text-slate-300 dark:text-neutral-600 cursor-grab" />

              <div className="w-1/3">
                <input
                  type="text"
                  readOnly={readOnly}
                  value={item.key || ''}
                  onChange={(e) => updateMetadataField(item.id, 'key', e.target.value)}
                  className="w-full text-xs font-semibold text-slate-600 dark:text-neutral-300 bg-slate-50 dark:bg-neutral-800 border border-transparent hover:border-slate-300 dark:hover:border-neutral-600 focus:border-blue-500 rounded-sm px-2 py-1.5 focus:outline-hidden bangla-text"
                />
              </div>

              <div className="flex-grow">
                <input
                  type="text"
                  readOnly={readOnly}
                  value={item.value || ''}
                  onChange={(e) => updateMetadataField(item.id, 'value', e.target.value)}
                  className="w-full text-sm text-slate-900 dark:text-neutral-100 dark:bg-transparent border border-slate-200 dark:border-neutral-700 rounded-sm px-2 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden bangla-text"
                />
              </div>

              <div className="w-24">
                <select
                  value={item.field_type || 'text'}
                  disabled={readOnly}
                  onChange={(e) => updateMetadataField(item.id, 'field_type', e.target.value)}
                  className="w-full text-xs border border-slate-200 dark:border-neutral-700 rounded-sm px-1 py-1.5 bg-white dark:bg-neutral-900 dark:text-neutral-100"
                >
                  <option value="text">Text</option>
                  <option value="date">Date</option>
                  <option value="number">Number</option>
                  <option value="phone">Phone</option>
                </select>
              </div>

              <div className="w-20 flex items-center justify-end space-x-2">
                <ConfidenceBadge confidence={item.confidence} />
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeField(item.id)}
                    className="cursor-pointer text-slate-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={addField}
            className="cursor-pointer mt-4 flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            <Plus className="h-3 w-3 mr-1" /> Add Metadata Field
          </button>
        )}
      </div>
    </div>
  );
};

export default MetadataSection;
