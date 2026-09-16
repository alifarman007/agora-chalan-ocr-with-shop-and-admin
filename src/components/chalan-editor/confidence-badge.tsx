'use client';

import React from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ConfidenceBadgeProps {
  confidence: number;
  className?: string;
}

const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ confidence, className }) => {
  // Normalize confidence (sometimes models return 0-100, sometimes 0-1)
  const score = confidence > 1 ? confidence / 100 : confidence;

  if (score >= 0.9) {
    return (
      <div
        className={cn('inline-flex items-center text-green-600 dark:text-green-400', className)}
        title={`High Confidence (${(score * 100).toFixed(0)}%)`}
      >
        <CircleCheck className="h-4 w-4" />
      </div>
    );
  }

  if (score >= 0.7) {
    return (
      <div
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30',
          className,
        )}
        title="Please review this field"
      >
        Review
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center space-x-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-red-100 text-red-800 border border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
        className,
      )}
      title="Low confidence - check carefully"
    >
      <CircleAlert className="h-3 w-3" />
      <span>Low Conf.</span>
    </div>
  );
};

export default ConfidenceBadge;
