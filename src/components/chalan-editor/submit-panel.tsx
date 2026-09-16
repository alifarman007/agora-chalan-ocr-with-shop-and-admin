'use client';

import React, { useState } from 'react';
import { DeliveryChalanDocument } from '@/types/delivery-chalan';
import {
  Check,
  Copy,
  Download,
  TriangleAlert,
  FileSpreadsheet,
  LoaderCircle,
  CircleCheck,
  Save,
} from 'lucide-react';
import { generateExcel } from '@/lib/ocr/excelGenerator';
import { toast } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface SubmitPanelProps {
  document: DeliveryChalanDocument;
  correctionCount: number;
  onSubmit?: () => void | Promise<void>;
  onSaveDraft?: () => void | Promise<void>;
  submitting?: boolean;
  /** When true, hide Submit/Save and disable all editing. */
  readOnly?: boolean;
  /** Slot for a status banner (e.g. a rejection note) shown above the action row. */
  statusSlot?: React.ReactNode;
  className?: string;
}

const SubmitPanel: React.FC<SubmitPanelProps> = ({
  document: chalanData,
  correctionCount,
  onSubmit,
  onSaveDraft,
  submitting = false,
  readOnly = false,
  statusSlot,
  className,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(chalanData, null, 2));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(chalanData, null, 2));
    const downloadAnchorNode = window.document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute(
      'download',
      `chalan_${chalanData.chalan_number || 'export'}.json`,
    );
    window.document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  /**
   * file-saver is not a dependency of this project. `generateExcel` downloads the workbook
   * with URL.createObjectURL + a temporary <a download>; the .xlsx bytes and the filename
   * are exactly what the approved exporter produces.
   */
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      await generateExcel(chalanData);
    } catch (error) {
      console.error('Failed to export Excel:', error);
      toast.error('Failed to generate Excel file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!onSaveDraft) return;
    try {
      setIsSavingDraft(true);
      await onSaveDraft();
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    if (!onSubmit) return;
    await onSubmit();
  };

  return (
    <div
      className={cn(
        'bg-white dark:bg-neutral-900 border-t border-slate-200 dark:border-neutral-700 sticky bottom-0 z-10 shadow-lg',
        className,
      )}
    >
      {statusSlot ? <div className="px-4 pt-4">{statusSlot}</div> : null}

      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4 text-sm text-slate-500 dark:text-neutral-400">
          <span>{correctionCount} corrections made</span>
          {correctionCount > 0 && (
            <span className="text-orange-500 dark:text-orange-400 flex items-center text-xs">
              <TriangleAlert className="h-3 w-3 mr-1" /> Edited
            </span>
          )}
        </div>

        <div className="flex space-x-3 items-center">
          <button
            type="button"
            onClick={handleCopy}
            className={`cursor-pointer flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isCopied
                ? 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 dark:bg-neutral-900 dark:text-neutral-200 dark:border-neutral-600 dark:hover:bg-neutral-800'
            }`}
          >
            {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="hidden sm:inline">{isCopied ? 'JSON Copied' : 'Copy JSON'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadJSON}
            className="cursor-pointer flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 dark:bg-neutral-900 dark:text-neutral-200 dark:border-neutral-600 dark:hover:bg-neutral-800 transition-all"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download JSON</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            className="cursor-pointer flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-bold text-white transition-all bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            {isExporting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            <span>Export to Excel</span>
          </button>

          {!readOnly && onSaveDraft && (
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSavingDraft || submitting}
              className="cursor-pointer flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 dark:bg-neutral-900 dark:text-neutral-200 dark:border-neutral-600 dark:hover:bg-neutral-800 transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
            >
              {isSavingDraft ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Save draft</span>
            </button>
          )}

          {!readOnly && onSubmit && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || isSavingDraft}
              className="cursor-pointer flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
            >
              {submitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <CircleCheck className="h-4 w-4" />
              )}
              <span>Submit for approval</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubmitPanel;
