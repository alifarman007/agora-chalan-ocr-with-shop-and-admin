import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const emptyStateVariants = cva(
  'flex w-full flex-col items-center justify-center text-center',
  {
    variants: {
      size: {
        sm: 'gap-2 px-4 py-8',
        default: 'gap-3 px-6 py-14',
        lg: 'gap-4 px-6 py-20',
      },
      /** `card` draws a dashed surface, `bare` sits inside an existing card. */
      surface: {
        card: 'rounded-[var(--radius)] border border-dashed border-border bg-card/60',
        bare: '',
      },
    },
    defaultVariants: { size: 'default', surface: 'card' },
  },
);

const TONES = {
  neutral: {
    halo: 'bg-slate-100 dark:bg-slate-800',
    ring: 'ring-slate-200/70 dark:ring-slate-700/50',
    icon: 'text-slate-500 dark:text-slate-400',
  },
  brand: {
    halo: 'bg-blue-50 dark:bg-blue-500/15',
    ring: 'ring-blue-100/80 dark:ring-blue-500/10',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  success: {
    halo: 'bg-emerald-50 dark:bg-emerald-500/15',
    ring: 'ring-emerald-100/80 dark:ring-emerald-500/10',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    halo: 'bg-amber-50 dark:bg-amber-500/15',
    ring: 'ring-amber-100/80 dark:ring-amber-500/10',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  destructive: {
    halo: 'bg-red-50 dark:bg-red-500/15',
    ring: 'ring-red-100/80 dark:ring-red-500/10',
    icon: 'text-red-600 dark:text-red-400',
  },
} as const;

export type EmptyStateTone = keyof typeof TONES;

export interface EmptyStateProps
  extends Omit<React.ComponentProps<'div'>, 'title'>,
    VariantProps<typeof emptyStateVariants> {
  /** A lucide icon element, e.g. `<Inbox />`. Sized and coloured for you. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Primary call to action. */
  action?: React.ReactNode;
  /** Optional secondary action shown next to `action`. */
  secondaryAction?: React.ReactNode;
  /** Colour of the icon halo. */
  tone?: EmptyStateTone;
  /** Class for the title + description block - apply `.bangla-text` here. */
  contentClassName?: string;
}

/**
 * The house empty state. It appears on every list in the dashboard, so it is
 * deliberately a real piece of design: a haloed icon on a soft dashed surface,
 * a confident title, one explanatory line, and the action that fixes the
 * emptiness.
 */
export function EmptyState({
  className,
  contentClassName,
  icon,
  title,
  description,
  action,
  secondaryAction,
  tone = 'neutral',
  size,
  surface,
  children,
  ...props
}: EmptyStateProps) {
  const t = TONES[tone];

  return (
    <div className={cn(emptyStateVariants({ size, surface }), className)} {...props}>
      {icon ? (
        <div
          aria-hidden="true"
          className={cn(
            'mb-1 flex size-12 items-center justify-center rounded-full ring-8',
            '[&_svg]:size-6',
            t.halo,
            t.ring,
            t.icon,
          )}
        >
          {icon}
        </div>
      ) : null}

      <div className={cn('flex max-w-sm flex-col gap-1.5', contentClassName)}>
        <h3 className="text-base font-semibold leading-tight tracking-tight text-foreground">
          {title}
        </h3>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {children}

      {action || secondaryAction ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

EmptyState.displayName = 'EmptyState';
