'use client';

import React, { useState } from 'react';
import { ChartColumn, ChevronDown, ChevronUp, Coins, Zap } from 'lucide-react';
import { ModelType, UsageMetadata } from '@/types/ocr';
import { calculateCost } from '@/lib/ocr/costCalculator';
import { cn } from '@/lib/cn';

export interface AnalyticsPanelProps {
  ocrUsage?: UsageMetadata | null;
  structuringUsage?: UsageMetadata | null;
  modelUsed: ModelType;
  className?: string;
}

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  ocrUsage,
  structuringUsage,
  modelUsed,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Step 1 (OCR) and step 2 (structuring) are billed separately, then summed.
  const usage1 = ocrUsage;
  const usage2 = structuringUsage;
  const model = modelUsed;

  if (!usage1 && !usage2) return null;

  // Calculate combined totals if both exist
  const totalPromptTokens = (usage1?.promptTokenCount || 0) + (usage2?.promptTokenCount || 0);
  const totalCandidatesTokens =
    (usage1?.candidatesTokenCount || 0) + (usage2?.candidatesTokenCount || 0);
  const totalTokens = (usage1?.totalTokenCount || 0) + (usage2?.totalTokenCount || 0);

  const costs = calculateCost(model, totalPromptTokens, totalCandidatesTokens);

  return (
    <div
      className={cn(
        'bg-white dark:bg-neutral-900 rounded-xl shadow-xs border border-slate-200 dark:border-neutral-700 overflow-hidden mb-6',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="cursor-pointer w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-neutral-800/50 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
      >
        <div className="flex items-center space-x-2 text-slate-700 dark:text-neutral-200">
          <ChartColumn className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <span className="font-semibold text-sm">Processing Analytics</span>
          <span className="text-xs text-slate-500 dark:text-neutral-400 font-normal ml-2">
            ({totalTokens.toLocaleString('en-US')} tokens)
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-slate-400 dark:text-neutral-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400 dark:text-neutral-500" />
        )}
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-200 dark:border-neutral-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Token Usage */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-3 flex items-center">
                <Zap className="h-3 w-3 mr-1" /> Token Usage
              </h4>
              <div className="space-y-2">
                {usage1 && (
                  <div className="flex justify-between text-xs text-slate-500 dark:text-neutral-400 italic">
                    <span>Step 1: OCR Extraction</span>
                    <span>{(usage1.totalTokenCount || 0).toLocaleString('en-US')}</span>
                  </div>
                )}
                {usage2 && (
                  <div className="flex justify-between text-xs text-slate-500 dark:text-neutral-400 italic">
                    <span>Step 2: Data Structuring</span>
                    <span>{(usage2.totalTokenCount || 0).toLocaleString('en-US')}</span>
                  </div>
                )}
                <div className="pt-1 border-t border-slate-100 dark:border-neutral-800"></div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-neutral-300">Total Input Tokens:</span>
                  <span className="font-mono text-slate-900 dark:text-neutral-100">
                    {totalPromptTokens.toLocaleString('en-US')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-neutral-300">Total Output Tokens:</span>
                  <span className="font-mono text-slate-900 dark:text-neutral-100">
                    {totalCandidatesTokens.toLocaleString('en-US')}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-slate-100 dark:border-neutral-800 font-medium">
                  <span className="text-slate-800 dark:text-neutral-100">Total Tokens:</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">
                    {totalTokens.toLocaleString('en-US')}
                  </span>
                </div>
              </div>
            </div>

            {/* Cost Estimates */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-3 flex items-center">
                <Coins className="h-3 w-3 mr-1" /> Estimated Cost
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-neutral-300">Processing Cost:</span>
                  <span className="font-mono text-slate-900 dark:text-neutral-100">
                    ${costs.inputCost.toFixed(6)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-neutral-300">Generation Cost:</span>
                  <span className="font-mono text-slate-900 dark:text-neutral-100">
                    ${costs.outputCost.toFixed(6)}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-slate-100 dark:border-neutral-800 font-medium">
                  <span className="text-slate-800 dark:text-neutral-100">Total Request Cost:</span>
                  <span className="font-mono text-green-600 dark:text-green-400">
                    ${costs.totalCost.toFixed(6)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-2">
                  * Estimated from published per-token rates — approximate, for reference only.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPanel;
