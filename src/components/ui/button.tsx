'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Button — the single action primitive for the whole dashboard.
 *
 * There is deliberately no `asChild` / Slot indirection (no Radix in this
 * project). To style a `next/link` or an `<a>` like a button, spread the
 * exported `buttonVariants()` helper onto it instead:
 *
 *   <Link href="/upload" className={buttonVariants({ variant: 'default' })}>
 */
export const buttonVariants = cva(
  [
    'relative inline-flex shrink-0 select-none items-center justify-center gap-2',
    'whitespace-nowrap font-medium leading-none',
    'rounded-[calc(var(--radius)_-_2px)]',
    'cursor-pointer',
    'transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 ease-out',
    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'active:translate-y-px',
    'disabled:pointer-events-none disabled:opacity-50 disabled:active:translate-y-0',
    'aria-disabled:pointer-events-none aria-disabled:opacity-50',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        /** Primary action — indigo, matches the approved OCR app. */
        default:
          'bg-indigo-600 text-white shadow-xs hover:bg-indigo-700 active:bg-indigo-800 dark:bg-indigo-600 dark:hover:bg-indigo-500',
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
        outline:
          'border border-border bg-card text-foreground shadow-xs hover:bg-muted hover:text-foreground dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800',
        ghost:
          'text-foreground hover:bg-muted hover:text-foreground dark:hover:bg-slate-800',
        destructive:
          'bg-red-600 text-white shadow-xs hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500 dark:bg-red-600 dark:hover:bg-red-500',
        /** Export / confirm-positive action — emerald. */
        success:
          'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 focus-visible:ring-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500',
        /** Brand-accent action (links, "view" affordances) — blue. */
        link: 'text-blue-600 underline-offset-4 hover:underline dark:text-blue-400',
      },
      size: {
        sm: 'h-8 px-3 text-xs gap-1.5',
        default: 'h-9 px-4 text-sm',
        lg: 'h-11 px-6 text-sm',
        icon: 'size-9 p-0',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      fullWidth: false,
    },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;

export interface ButtonProps
  extends Omit<React.ComponentProps<'button'>, 'color'>,
    VariantProps<typeof buttonVariants> {
  /** Shows a spinner, hides the leading icon and disables the button. */
  loading?: boolean;
  /** Optional text shown while `loading` is true (falls back to children). */
  loadingText?: React.ReactNode;
  /** Icon rendered before the label. Replaced by the spinner while loading. */
  leftIcon?: React.ReactNode;
  /** Icon rendered after the label. */
  rightIcon?: React.ReactNode;
}

export function Button({
  className,
  variant,
  size,
  fullWidth,
  loading = false,
  loadingText,
  leftIcon,
  rightIcon,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      data-loading={loading ? '' : undefined}
      aria-busy={loading || undefined}
      disabled={isDisabled}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    >
      {loading ? (
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        leftIcon
      )}
      {loading && loadingText ? loadingText : children}
      {!loading && rightIcon}
    </button>
  );
}

Button.displayName = 'Button';
