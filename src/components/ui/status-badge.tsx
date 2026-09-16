import * as React from 'react';
import {
  CircleCheck,
  CircleX,
  Clock,
  CloudUpload,
  LoaderCircle,
  SquarePen,
  TriangleAlert,
} from 'lucide-react';
import { cn } from '@/lib/cn';

/** Every lifecycle state a document can be in, document + approval flow. */
export type DocumentStatus =
  | 'uploaded'
  | 'processing'
  | 'failed'
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected';

type StatusSpec = {
  label: string;
  /** Longer sentence for tooltips / empty states. */
  hint: string;
  className: string;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  spin?: boolean;
};

export const STATUS_SPECS: Record<DocumentStatus, StatusSpec> = {
  uploaded: {
    label: 'Uploaded',
    hint: 'Waiting in the queue to be read.',
    className:
      'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
    Icon: CloudUpload,
  },
  processing: {
    label: 'Processing',
    hint: 'The OCR engine is reading this chalan.',
    className:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300',
    Icon: LoaderCircle,
    spin: true,
  },
  failed: {
    label: 'Failed',
    hint: 'Processing could not finish. Try uploading again.',
    className:
      'border-red-300 bg-red-100 text-red-900 dark:border-red-500/40 dark:bg-red-950/60 dark:text-red-200',
    Icon: TriangleAlert,
  },
  draft: {
    label: 'Needs review',
    hint: 'Extracted, but nobody has checked the numbers yet.',
    className:
      'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
    Icon: SquarePen,
  },
  pending_approval: {
    label: 'Pending approval',
    hint: 'Sent to an approver and waiting on their decision.',
    className:
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300',
    Icon: Clock,
  },
  approved: {
    label: 'Approved',
    hint: 'Signed off and ready to export.',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300',
    Icon: CircleCheck,
  },
  rejected: {
    label: 'Rejected',
    hint: 'Sent back for correction.',
    className:
      'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300',
    Icon: CircleX,
  },
};

/** Human label for a status — handy for tooltips, filters and CSV exports. */
export function statusLabel(status: DocumentStatus): string {
  return STATUS_SPECS[status]?.label ?? status;
}

export interface StatusBadgeProps extends Omit<React.ComponentProps<'span'>, 'children'> {
  status: DocumentStatus;
  /** Hide the icon for very dense tables. */
  showIcon?: boolean;
  size?: 'sm' | 'default';
  /** Override the built-in label (still keeps the colour + icon). */
  label?: React.ReactNode;
}

export function StatusBadge({
  status,
  showIcon = true,
  size = 'default',
  label,
  className,
  ...props
}: StatusBadgeProps) {
  const spec = STATUS_SPECS[status] ?? STATUS_SPECS.draft;
  const { Icon } = spec;

  return (
    <span
      title={spec.hint}
      data-status={status}
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-medium leading-none',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        spec.className,
        className,
      )}
      {...props}
    >
      {showIcon ? (
        <Icon
          aria-hidden="true"
          className={cn(size === 'sm' ? 'size-3' : 'size-3.5', spec.spin && 'animate-spin')}
        />
      ) : null}
      {label ?? spec.label}
    </span>
  );
}

StatusBadge.displayName = 'StatusBadge';
