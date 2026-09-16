'use client';

import React, { useState } from 'react';
import { DeliveryChalanDocument } from '@/types/delivery-chalan';
import HeaderSection from './header-section';
import PartyInfoSection from './party-info-section';
import MetadataSection from './metadata-section';
import LineItemsTable from './line-items-table';
import SummarySection from './summary-section';
import SubmitPanel from './submit-panel';
import { ChevronRight, ChevronLeft, FileText } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ChalanEditorProps {
  document: DeliveryChalanDocument;
  imageUrl: string;
  mimeType?: string;
  /** When true, hide Submit/Save and disable all editing. */
  readOnly?: boolean;
  /** Lifts the current value out so the page can autosave. */
  onChange?: (next: DeliveryChalanDocument, correctionCount: number) => void;
  onSubmit?: () => void | Promise<void>;
  onSaveDraft?: () => void | Promise<void>;
  submitting?: boolean;
  /** Slot for a status banner (e.g. a rejection note). */
  statusSlot?: React.ReactNode;
  className?: string;
}

const ChalanEditor: React.FC<ChalanEditorProps> = ({
  document: initialDocument,
  imageUrl,
  mimeType,
  readOnly = false,
  onChange,
  onSubmit,
  onSaveDraft,
  submitting = false,
  statusSlot,
  className,
}) => {
  const [document, setDocument] = useState<DeliveryChalanDocument>(initialDocument);
  const [correctionCount, setCorrectionCount] = useState(0);
  const [showRawText, setShowRawText] = useState(false);

  const handleUpdate = (updates: Partial<DeliveryChalanDocument>) => {
    const next = { ...document, ...updates };
    const nextCount = correctionCount + 1;
    setDocument(next);
    setCorrectionCount(nextCount);
    onChange?.(next, nextCount);
  };

  const isPdf = mimeType === 'application/pdf';

  return (
    <div className={cn('bg-white dark:bg-neutral-900', className)}>
      <div className="flex h-[calc(100vh-140px)] bg-slate-100 dark:bg-neutral-950 rounded-xl overflow-hidden border border-slate-200 dark:border-neutral-700">
        {/* LEFT PANEL: Image Viewer */}
        <div className="w-2/5 flex flex-col border-r border-slate-200 dark:border-neutral-700 bg-slate-800 relative group">
          <div className="flex-grow overflow-auto flex items-center justify-center p-4">
            {isPdf ? (
              <iframe
                src={imageUrl}
                title="Original Chalan"
                className="w-full h-full border-0 shadow-2xl rounded-sm bg-white"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Original Chalan"
                className="max-w-full h-auto shadow-2xl rounded-sm"
              />
            )}
          </div>

          {/* Raw Text Drawer */}
          <div
            className={`absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 transition-all duration-300 ease-in-out flex flex-col ${
              showRawText ? 'h-1/2 shadow-[0_-10px_40px_rgba(0,0,0,0.2)]' : 'h-10'
            }`}
          >
            <button
              type="button"
              onClick={() => setShowRawText(!showRawText)}
              className="cursor-pointer flex items-center justify-between px-4 h-10 bg-slate-900 text-white text-xs font-semibold uppercase tracking-wider w-full hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center">
                <FileText className="h-3 w-3 mr-2" />
                Raw OCR Text (Reference)
              </div>
              {showRawText ? (
                <ChevronRight className="h-4 w-4 rotate-90" />
              ) : (
                <ChevronLeft className="h-4 w-4 rotate-90" />
              )}
            </button>
            <div className="flex-grow overflow-auto p-4 font-mono text-xs text-slate-600 dark:text-neutral-300 bg-slate-50 dark:bg-neutral-800/50 whitespace-pre-wrap">
              {document.raw_ocr_text}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Editor Form */}
        <div className="w-3/5 flex flex-col bg-white dark:bg-neutral-900">
          <div className="flex-grow overflow-y-auto p-6 scroll-smooth">
            <HeaderSection document={document} onUpdate={handleUpdate} readOnly={readOnly} />

            <PartyInfoSection document={document} onUpdate={handleUpdate} readOnly={readOnly} />

            <MetadataSection document={document} onUpdate={handleUpdate} readOnly={readOnly} />

            <LineItemsTable document={document} onUpdate={handleUpdate} readOnly={readOnly} />

            <SummarySection document={document} onUpdate={handleUpdate} readOnly={readOnly} />
          </div>

          <SubmitPanel
            document={document}
            correctionCount={correctionCount}
            onSubmit={onSubmit}
            onSaveDraft={onSaveDraft}
            submitting={submitting}
            readOnly={readOnly}
            statusSlot={statusSlot}
          />
        </div>
      </div>
    </div>
  );
};

export default ChalanEditor;
