'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

/**
 * Shared field chrome for Input / Textarea / Select so every control in the
 * app lines up on the same height, radius and focus ring.
 *
 * Error state is driven purely by `aria-invalid` — set it from your form state
 * and the red ring comes for free, no `error` boolean to keep in sync.
 */
export const fieldVariants = cva(
  [
    'w-full min-w-0 bg-background text-foreground',
    'rounded-[calc(var(--radius)_-_2px)] border border-input shadow-xs',
    'placeholder:text-muted-foreground',
    'transition-[color,background-color,border-color,box-shadow] duration-150',
    'focus-visible:outline-hidden focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/30',
    'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-70',
    'read-only:bg-muted/50',
    'aria-invalid:border-red-500 aria-invalid:focus-visible:border-red-500 aria-invalid:focus-visible:ring-red-500/30',
    'dark:bg-slate-950 dark:aria-invalid:border-red-500/70',
    'file:mr-3 file:cursor-pointer file:rounded-sm file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground',
  ],
  {
    variants: {
      inputSize: {
        sm: 'h-8 px-2.5 py-1 text-xs',
        default: 'h-9 px-3 py-1.5 text-sm',
        lg: 'h-11 px-4 py-2 text-sm',
      },
    },
    defaultVariants: { inputSize: 'default' },
  },
);

export type FieldSize = NonNullable<VariantProps<typeof fieldVariants>['inputSize']>;

export interface InputProps
  extends Omit<React.ComponentProps<'input'>, 'size'>,
    VariantProps<typeof fieldVariants> {
  /** Icon rendered inside the field, on the left. */
  leftIcon?: React.ReactNode;
  /** Icon or small control rendered inside the field, on the right. */
  rightIcon?: React.ReactNode;
  /** Static text pinned to the right, e.g. a "BDT" unit suffix. */
  suffix?: React.ReactNode;
  /** Wrapper class — use when the field must stretch or shrink in a grid. */
  containerClassName?: string;
}

export function Input({
  className,
  containerClassName,
  inputSize,
  leftIcon,
  rightIcon,
  suffix,
  type = 'text',
  ...props
}: InputProps) {
  const field = (
    <input
      type={type}
      className={cn(
        fieldVariants({ inputSize }),
        leftIcon && 'pl-9',
        (rightIcon || suffix) && 'pr-9',
        className,
      )}
      {...props}
    />
  );

  if (!leftIcon && !rightIcon && !suffix) {
    return containerClassName ? (
      <div className={cn('relative', containerClassName)}>{field}</div>
    ) : (
      field
    );
  }

  return (
    <div className={cn('relative flex w-full items-center', containerClassName)}>
      {leftIcon ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 flex items-center text-muted-foreground [&_svg]:size-4"
        >
          {leftIcon}
        </span>
      ) : null}
      {field}
      {rightIcon || suffix ? (
        <span
          className={cn(
            'absolute right-3 flex items-center text-muted-foreground [&_svg]:size-4',
            suffix && !rightIcon && 'pointer-events-none text-xs font-medium',
          )}
        >
          {rightIcon ?? suffix}
        </span>
      ) : null}
    </div>
  );
}

Input.displayName = 'Input';

export interface TextareaProps
  extends Omit<React.ComponentProps<'textarea'>, 'size'>,
    VariantProps<typeof fieldVariants> {
  /** Grows the textarea to fit its content as the user types. */
  autoResize?: boolean;
}

export function Textarea({
  className,
  inputSize,
  autoResize = false,
  rows = 3,
  onChange,
  ref,
  ...props
}: TextareaProps) {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

  const resize = React.useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  React.useEffect(() => {
    if (autoResize) resize(innerRef.current);
  }, [autoResize, resize, props.value]);

  return (
    <textarea
      rows={rows}
      ref={(node) => {
        innerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      onChange={(event) => {
        if (autoResize) resize(event.currentTarget);
        onChange?.(event);
      }}
      className={cn(
        fieldVariants({ inputSize }),
        'h-auto min-h-[4.5rem] resize-y leading-relaxed',
        autoResize && 'resize-none overflow-hidden',
        className,
      )}
      {...props}
    />
  );
}

Textarea.displayName = 'Textarea';

export type FieldErrorProps = React.ComponentProps<'p'>;

/** Small red helper line to pair with an `aria-invalid` field. */
export function FieldError({ className, children, ...props }: FieldErrorProps) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={cn('text-xs font-medium text-red-600 dark:text-red-400', className)}
      {...props}
    >
      {children}
    </p>
  );
}

/** Muted helper line under a field. */
export function FieldHint({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-xs text-muted-foreground', className)} {...props} />;
}
