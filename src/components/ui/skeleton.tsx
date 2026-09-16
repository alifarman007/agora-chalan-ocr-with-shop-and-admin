import * as React from 'react';
import { cn } from '@/lib/cn';

export interface SkeletonProps extends React.ComponentProps<'div'> {
  /** `text` gets a line height + slightly rounder corners, `circle` is round. */
  shape?: 'block' | 'text' | 'circle';
}

export function Skeleton({ className, shape = 'block', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-slate-200/80 dark:bg-slate-700/60',
        shape === 'circle' && 'rounded-full',
        shape === 'text' && 'h-4 rounded-sm',
        shape === 'block' && 'rounded-[calc(var(--radius)_-_2px)]',
        className,
      )}
      {...props}
    />
  );
}

export interface TableSkeletonProps extends React.ComponentProps<'div'> {
  rows?: number;
  cols?: number;
  /** Render the grey header strip above the rows. */
  showHeader?: boolean;
  /** Wrap in the bordered card surface that a real `Table` has. */
  bordered?: boolean;
}

/**
 * Placeholder that matches the geometry of `Table` - same 40px header,
 * same row height - so there is no layout jump when the data lands.
 */
export function TableSkeleton({
  rows = 5,
  cols = 4,
  showHeader = true,
  bordered = true,
  className,
  ...props
}: TableSkeletonProps) {
  const widths = ['w-2/3', 'w-1/2', 'w-3/4', 'w-1/3', 'w-5/6', 'w-2/5'];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'w-full overflow-hidden',
        bordered && 'rounded-[var(--radius)] border border-border bg-card',
        className,
      )}
      {...props}
    >
      <span className="sr-only">Loading table data</span>
      {showHeader ? (
        <div
          className="flex h-10 items-center gap-3 border-b border-border bg-muted/60 px-3"
          aria-hidden="true"
        >
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="flex-1">
              <Skeleton shape="text" className="h-3 w-20" />
            </div>
          ))}
        </div>
      ) : null}
      <div className="divide-y divide-border" aria-hidden="true">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-3 px-3 py-3">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="flex-1">
                <Skeleton
                  shape="text"
                  className={cn('h-3.5', widths[(r + c) % widths.length])}
                  style={{ animationDelay: `${(r * cols + c) * 40}ms` }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface CardSkeletonProps extends React.ComponentProps<'div'> {
  /** Number of body lines. */
  lines?: number;
  /** Show the round avatar/icon block in the header. */
  showAvatar?: boolean;
  /** Show the footer button placeholders. */
  showFooter?: boolean;
}

export function CardSkeleton({
  lines = 3,
  showAvatar = false,
  showFooter = false,
  className,
  ...props
}: CardSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn(
        'flex flex-col rounded-[var(--radius)] border border-border bg-card p-5 shadow-xs',
        className,
      )}
      {...props}
    >
      <span className="sr-only">Loading</span>
      <div className="flex items-center gap-3" aria-hidden="true">
        {showAvatar ? <Skeleton shape="circle" className="size-10" /> : null}
        <div className="flex-1 space-y-2">
          <Skeleton shape="text" className="h-4 w-1/3" />
          <Skeleton shape="text" className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-5 space-y-2.5" aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            shape="text"
            className={cn('h-3', i === lines - 1 ? 'w-2/5' : 'w-full')}
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
      {showFooter ? (
        <div className="mt-6 flex gap-2" aria-hidden="true">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      ) : null}
    </div>
  );
}

/** A grid of `CardSkeleton`s - for dashboard stat rows and card lists. */
export interface CardGridSkeletonProps extends React.ComponentProps<'div'> {
  count?: number;
  lines?: number;
}

export function CardGridSkeleton({
  count = 3,
  lines = 2,
  className,
  ...props
}: CardGridSkeletonProps) {
  return (
    <div
      className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}
      {...props}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} lines={lines} />
      ))}
    </div>
  );
}
