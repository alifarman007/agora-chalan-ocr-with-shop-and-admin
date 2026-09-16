'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { fieldVariants } from './input';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectOptionGroup {
  label: string;
  options: SelectOption[];
}

export interface SelectProps
  extends Omit<React.ComponentProps<'select'>, 'size' | 'children'>,
    VariantProps<typeof fieldVariants> {
  /**
   * Options to render. Accepts a flat list, a list of groups, or plain strings.
   * Omit it and pass `children` instead if you need full control.
   */
  options?: Array<SelectOption | SelectOptionGroup | string>;
  /** Rendered as a disabled first option with an empty value. */
  placeholder?: string;
  /** Use instead of `options` for hand-written `<option>` markup. */
  children?: React.ReactNode;
  /** Wrapper class — the wrapper owns the layout, the select owns the chrome. */
  containerClassName?: string;
}

function isGroup(o: SelectOption | SelectOptionGroup | string): o is SelectOptionGroup {
  return typeof o === 'object' && 'options' in o;
}

function normalise(o: SelectOption | string): SelectOption {
  return typeof o === 'string' ? { label: o, value: o } : o;
}

export function Select({
  className,
  containerClassName,
  inputSize,
  options,
  placeholder,
  children,
  value,
  defaultValue,
  ...props
}: SelectProps) {
  return (
    <div className={cn('relative flex w-full items-center', containerClassName)}>
      <select
        value={value}
        defaultValue={defaultValue ?? (placeholder && value === undefined ? '' : undefined)}
        className={cn(
          fieldVariants({ inputSize }),
          'cursor-pointer appearance-none pr-9',
          '[&>option]:bg-background [&>option]:text-foreground',
          '[&>optgroup]:bg-background [&>optgroup]:text-muted-foreground',
          className,
        )}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options?.map((entry, i) =>
          isGroup(entry) ? (
            <optgroup key={`${entry.label}-${i}`} label={entry.label}>
              {entry.options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
            </optgroup>
          ) : (
            (() => {
              const opt = normalise(entry);
              return (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              );
            })()
          ),
        )}
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 size-4 text-muted-foreground"
      />
    </div>
  );
}

Select.displayName = 'Select';
