'use client';

import * as React from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface CheckboxProps extends Omit<React.ComponentProps<'input'>, 'type' | 'size'> {
  /** Tri-state: renders the dash glyph and sets the DOM `indeterminate` flag. */
  indeterminate?: boolean;
  /** Optional inline label. Clicking it toggles the box. */
  label?: React.ReactNode;
  /** Muted second line under the label. */
  description?: React.ReactNode;
  /** Class for the outer <label>/<span> wrapper. */
  containerClassName?: string;
  /** Class for the label text — apply `.bangla-text` here. */
  labelClassName?: string;
}

export function Checkbox({
  className,
  containerClassName,
  labelClassName,
  indeterminate = false,
  label,
  description,
  disabled,
  id,
  ref,
  ...props
}: CheckboxProps) {
  const innerRef = React.useRef<HTMLInputElement | null>(null);
  const autoId = React.useId();
  const inputId = id ?? autoId;

  React.useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const box = (
    <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        id={inputId}
        disabled={disabled}
        aria-checked={indeterminate ? 'mixed' : undefined}
        ref={(node) => {
          innerRef.current = node;
          if (node) node.indeterminate = indeterminate;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        className={cn(
          'peer size-4 shrink-0 cursor-pointer appearance-none rounded-[4px] border border-input bg-background shadow-xs',
          'transition-[background-color,border-color,box-shadow] duration-150',
          'hover:border-indigo-400',
          'checked:border-indigo-600 checked:bg-indigo-600 checked:hover:bg-indigo-700',
          'indeterminate:border-indigo-600 indeterminate:bg-indigo-600',
          'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input',
          'aria-invalid:border-red-500',
          'dark:bg-slate-950',
          className,
        )}
        {...props}
      />
      <Check
        aria-hidden="true"
        strokeWidth={3}
        className="pointer-events-none absolute size-3 text-white opacity-0 transition-opacity peer-checked:opacity-100 peer-indeterminate:opacity-0"
      />
      <Minus
        aria-hidden="true"
        strokeWidth={3}
        className="pointer-events-none absolute size-3 text-white opacity-0 transition-opacity peer-indeterminate:opacity-100"
      />
    </span>
  );

  if (!label && !description) {
    return containerClassName ? (
      <span className={cn('inline-flex', containerClassName)}>{box}</span>
    ) : (
      box
    );
  }

  return (
    <div
      className={cn(
        'flex items-start gap-2.5',
        disabled && 'opacity-60',
        containerClassName,
      )}
    >
      <span className="flex h-5 items-center">{box}</span>
      <div className="min-w-0 leading-tight">
        <label
          htmlFor={inputId}
          className={cn(
            'block text-sm font-medium text-foreground',
            disabled ? 'cursor-not-allowed' : 'cursor-pointer',
            labelClassName,
          )}
        >
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

Checkbox.displayName = 'Checkbox';
