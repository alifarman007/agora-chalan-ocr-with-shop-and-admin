import * as React from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export type SpinnerSize = 'xs' | 'sm' | 'default' | 'lg' | 'xl';

const SIZES: Record<SpinnerSize, string> = {
  xs: 'size-3',
  sm: 'size-4',
  default: 'size-5',
  lg: 'size-8',
  xl: 'size-10',
};

export interface SpinnerProps extends React.ComponentProps<'span'> {
  size?: SpinnerSize;
  /** Visible text next to the spinner. Also used as the accessible name. */
  label?: React.ReactNode;
  /** Announce to screen readers without showing the label. Default true. */
  srOnlyLabel?: boolean;
  /** Class for the spinning glyph itself (e.g. a colour override). */
  iconClassName?: string;
}

export function Spinner({
  className,
  iconClassName,
  size = 'default',
  label = 'Loading',
  srOnlyLabel = true,
  ...props
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}
      {...props}
    >
      <LoaderCircle
        aria-hidden="true"
        className={cn('animate-spin motion-reduce:animate-none', SIZES[size], iconClassName)}
      />
      {srOnlyLabel ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className="text-sm">{label}</span>
      )}
    </span>
  );
}

Spinner.displayName = 'Spinner';

export interface FullPageSpinnerProps extends React.ComponentProps<'div'> {
  label?: React.ReactNode;
  /** Muted second line, e.g. "Reading page 2 of 6". */
  description?: React.ReactNode;
  /**
   * `page` fills its parent (route-level loading.tsx),
   * `overlay` covers the parent with a blurred scrim (in-place saving).
   */
  variant?: 'page' | 'overlay';
}

/** Centred loading state for a whole route or an in-place blocking action. */
export function FullPageSpinner({
  className,
  label = 'Loading',
  description,
  variant = 'page',
  ...props
}: FullPageSpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        variant === 'page' && 'min-h-[60vh] w-full p-8',
        variant === 'overlay' &&
          'absolute inset-0 z-40 rounded-[inherit] bg-background/70 backdrop-blur-[2px]',
        className,
      )}
      {...props}
    >
      <LoaderCircle
        aria-hidden="true"
        className="size-8 animate-spin text-indigo-600 motion-reduce:animate-none dark:text-indigo-400"
      />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}

FullPageSpinner.displayName = 'FullPageSpinner';
