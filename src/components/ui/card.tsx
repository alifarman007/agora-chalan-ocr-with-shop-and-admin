import * as React from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends React.ComponentProps<'div'> {
  /** Lifts the card on hover — use for clickable cards only. */
  interactive?: boolean;
  /** Removes the drop shadow for cards nested inside another surface. */
  flat?: boolean;
}

export function Card({ className, interactive = false, flat = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-[var(--radius)] border border-border bg-card text-card-foreground',
        !flat && 'shadow-xs',
        interactive &&
          'cursor-pointer transition-[box-shadow,border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:hover:border-slate-600 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
      {...props}
    />
  );
}

export interface CardHeaderProps extends React.ComponentProps<'div'> {
  /** Slot pinned to the right of the header (buttons, badges, menus). */
  action?: React.ReactNode;
  /** Adds a hairline rule under the header. */
  bordered?: boolean;
}

export function CardHeader({ className, action, bordered = false, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 px-5 py-4',
        bordered && 'border-b border-border',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-1">{children}</div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export interface CardTitleProps extends React.ComponentProps<'h3'> {
  /** Render as a different heading level for correct document outline. */
  as?: 'h1' | 'h2' | 'h3' | 'h4';
}

export function CardTitle({ className, as: Tag = 'h3', ...props }: CardTitleProps) {
  return (
    <Tag
      className={cn('text-base font-semibold leading-tight tracking-tight text-foreground', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm leading-relaxed text-muted-foreground', className)} {...props} />;
}

export interface CardContentProps extends React.ComponentProps<'div'> {
  /** Drop the horizontal padding — for full-bleed tables inside a card. */
  flush?: boolean;
}

export function CardContent({ className, flush = false, ...props }: CardContentProps) {
  return <div className={cn(flush ? 'py-0' : 'px-5 pb-5', 'min-w-0', className)} {...props} />;
}

export interface CardFooterProps extends React.ComponentProps<'div'> {
  /** Adds a hairline rule and a muted background strip. */
  bordered?: boolean;
}

export function CardFooter({ className, bordered = false, ...props }: CardFooterProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 px-5 py-4',
        bordered && 'mt-auto rounded-b-[var(--radius)] border-t border-border bg-muted/40',
        className,
      )}
      {...props}
    />
  );
}
