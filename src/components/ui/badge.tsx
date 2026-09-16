import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

export const badgeVariants = cva(
  [
    'inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap',
    'border font-medium leading-none',
    'transition-colors duration-150',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
  ],
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
        secondary:
          'border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        outline: 'border-border bg-transparent text-foreground',
        success:
          'border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
        warning:
          'border-transparent bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
        destructive:
          'border-transparent bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
        info: 'border-transparent bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
      },
      size: {
        sm: 'rounded-full px-1.5 py-0.5 text-[10px]',
        default: 'rounded-full px-2 py-0.5 text-xs',
        lg: 'rounded-full px-2.5 py-1 text-sm',
      },
      /** Adds a 1px tinted ring so badges read on white *and* on muted rows. */
      outlined: {
        true: 'ring-1 ring-inset ring-slate-900/5 dark:ring-white/10',
        false: '',
      },
    },
    defaultVariants: { variant: 'default', size: 'default', outlined: false },
  },
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

export interface BadgeProps
  extends React.ComponentProps<'span'>,
    VariantProps<typeof badgeVariants> {
  /** Small leading dot in the current text colour. */
  dot?: boolean;
  /** Icon before the label. */
  icon?: React.ReactNode;
}

export function Badge({ className, variant, size, outlined, dot = false, icon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size, outlined }), className)} {...props}>
      {dot ? (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-70" />
      ) : null}
      {icon}
      {children}
    </span>
  );
}

Badge.displayName = 'Badge';
