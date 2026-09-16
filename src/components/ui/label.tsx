import * as React from 'react';
import { cn } from '@/lib/cn';

export interface LabelProps extends React.ComponentProps<'label'> {
  /** Appends a red asterisk with an accessible "required" hint. */
  required?: boolean;
  /** Muted helper text shown inline after the label (e.g. "optional"). */
  hint?: React.ReactNode;
}

export function Label({ className, required = false, hint, children, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        'flex items-center gap-1.5 text-sm font-medium leading-none text-foreground',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        'has-[+_:disabled]:opacity-70',
        className,
      )}
      {...props}
    >
      <span className="min-w-0">{children}</span>
      {required ? (
        <span className="text-red-600 dark:text-red-400" aria-hidden="true">
          *
        </span>
      ) : null}
      {required ? <span className="sr-only">(required)</span> : null}
      {hint ? <span className="ml-auto text-xs font-normal text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

Label.displayName = 'Label';
