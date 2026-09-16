'use client';

import React from 'react';
import { DeliveryChalanDocument, PartyInfo } from '@/types/delivery-chalan';
import { MapPin, Phone, User, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface PartyInfoSectionProps {
  document: DeliveryChalanDocument;
  onUpdate: (updates: Partial<DeliveryChalanDocument>) => void;
  readOnly?: boolean;
  className?: string;
}

type PartyType = 'supplier' | 'buyer';

const PartyInfoSection: React.FC<PartyInfoSectionProps> = ({
  document,
  onUpdate,
  readOnly = false,
  className,
}) => {
  const commitParty = (type: PartyType, next: PartyInfo) => {
    onUpdate(type === 'supplier' ? { supplier: next } : { buyer: next });
  };

  const updateParty = (
    type: PartyType,
    field: keyof PartyInfo,
    value: string | Record<string, string> | undefined,
  ) => {
    commitParty(type, { ...document[type], [field]: value } as PartyInfo);
  };

  const updateAdditional = (type: PartyType, key: string, value: string) => {
    commitParty(type, {
      ...document[type],
      additional: {
        ...document[type].additional,
        [key]: value,
      },
    });
  };

  const addAdditionalField = (type: PartyType) => {
    const keyName = `Field ${Object.keys(document[type].additional || {}).length + 1}`;
    updateAdditional(type, keyName, '');
  };

  const renderPartyCard = (type: PartyType, title: string, data: PartyInfo) => (
    <div className="bg-white dark:bg-neutral-900 rounded-lg border border-slate-200 dark:border-neutral-700 shadow-xs p-4 flex flex-col h-full">
      <h3 className="text-sm font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-neutral-800 pb-2">
        {title}
      </h3>

      <div className="space-y-4 flex-grow">
        <div className="flex items-start space-x-3">
          <User className="h-4 w-4 text-slate-400 dark:text-neutral-500 mt-1" />
          <div className="flex-grow">
            <label className="block text-xs text-slate-400 dark:text-neutral-500 mb-0.5">Name</label>
            <input
              type="text"
              readOnly={readOnly}
              className="w-full text-sm font-medium border-slate-200 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-100 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 border p-1.5 bangla-text"
              value={data.name || ''}
              onChange={(e) => updateParty(type, 'name', e.target.value)}
              placeholder="Name..."
            />
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <MapPin className="h-4 w-4 text-slate-400 dark:text-neutral-500 mt-1" />
          <div className="flex-grow">
            <label className="block text-xs text-slate-400 dark:text-neutral-500 mb-0.5">Address</label>
            <textarea
              readOnly={readOnly}
              className="w-full text-sm border-slate-200 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-100 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 border p-1.5 resize-none h-20 bangla-text"
              value={data.address || ''}
              onChange={(e) => updateParty(type, 'address', e.target.value)}
              placeholder="Address details..."
            />
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <Phone className="h-4 w-4 text-slate-400 dark:text-neutral-500 mt-1" />
          <div className="flex-grow">
            <label className="block text-xs text-slate-400 dark:text-neutral-500 mb-0.5">Phone</label>
            <input
              type="text"
              readOnly={readOnly}
              className="w-full text-sm border-slate-200 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-100 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 border p-1.5"
              value={data.phone || ''}
              onChange={(e) => updateParty(type, 'phone', e.target.value)}
              placeholder="Phone number..."
            />
          </div>
        </div>

        {data.additional &&
          Object.entries(data.additional).map(([key, value], idx) => (
            <div
              key={idx}
              className="flex items-center space-x-2 pt-2 border-t border-slate-50 dark:border-neutral-800"
            >
              <input
                readOnly={readOnly}
                className="w-1/3 text-xs font-medium text-slate-500 dark:text-neutral-400 border-none focus:ring-0 bg-transparent text-right"
                value={key || ''}
                onChange={(e) => {
                  const newAdditional = { ...data.additional };
                  delete newAdditional[key];
                  newAdditional[e.target.value] = value;
                  updateParty(type, 'additional', newAdditional);
                }}
              />
              <span className="text-slate-300 dark:text-neutral-600">:</span>
              <input
                readOnly={readOnly}
                className="flex-grow text-sm border-slate-200 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-100 rounded-md p-1 border bangla-text"
                value={value || ''}
                onChange={(e) => updateAdditional(type, key, e.target.value)}
              />
            </div>
          ))}
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={() => addAdditionalField(type)}
          className="cursor-pointer mt-4 flex items-center justify-center text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium py-2 border border-dashed border-blue-200 dark:border-blue-500/40 rounded-md hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
        >
          <Plus className="h-3 w-3 mr-1" /> Add Field
        </button>
      )}
    </div>
  );

  return (
    <div className={cn('grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6', className)}>
      {renderPartyCard('supplier', 'Supplier (From)', document.supplier)}
      {renderPartyCard('buyer', 'Buyer (To)', document.buyer)}
    </div>
  );
};

export default PartyInfoSection;
