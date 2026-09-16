'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  type DialogSize,
} from './dialog';
import { FieldError, Input, Textarea } from './input';
import { Label } from './label';

export interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Label above the field. Defaults to the dialog title. */
  label?: React.ReactNode;
  placeholder?: string;
  /** Pre-filled value. Re-applied every time the dialog opens. */
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders a Textarea instead of an Input (rejection reasons, notes). */
  multiline?: boolean;
  /** Blocks submit on an empty / whitespace-only value. Default true. */
  required?: boolean;
  maxLength?: number;
  /** Return an error message to block submit, or null/undefined to allow it. */
  validate?: (value: string) => string | null | undefined;
  /**
   * Receives the trimmed value. If it returns a promise the confirm button
   * shows a spinner; the dialog closes on success and stays open on rejection.
   */
  onSubmit: (value: string) => void | Promise<unknown>;
  /** Red confirm button - for "reject with a reason" style prompts. */
  destructive?: boolean;
  size?: DialogSize;
  /** Class applied to the field - put `.bangla-text` here for Bangla input. */
  inputClassName?: string;
}

/**
 * Drop-in replacement for `window.prompt()`: asks for exactly one line of text
 * and hands it back. Used by the approved line-items table (edit a value,
 * reject with a reason) where a native prompt would break the theme and is
 * blocked in some browsers.
 */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  defaultValue = '',
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  multiline = false,
  required = true,
  maxLength,
  validate,
  onSubmit,
  destructive = false,
  size = 'sm',
  inputClassName,
}: PromptDialogProps) {
  const [value, setValue] = React.useState(defaultValue);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const fieldId = React.useId();
  const errorId = `${fieldId}-error`;

  // Re-seed on every open so a reused dialog never shows stale text. Adjusting
  // state during render (rather than in an effect) avoids a flash of the old
  // value on the first frame.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setValue(defaultValue);
      setError(null);
      setPending(false);
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim();

    if (required && trimmed.length === 0) {
      setError('This field cannot be empty.');
      return;
    }
    const custom = validate?.(trimmed);
    if (custom) {
      setError(custom);
      return;
    }

    setError(null);
    try {
      const result = onSubmit(trimmed);
      if (result instanceof Promise) {
        setPending(true);
        await result;
      }
      setPending(false);
      onOpenChange(false);
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    }
  };

  const fieldProps = {
    id: fieldId,
    value,
    placeholder,
    maxLength,
    disabled: pending,
    'aria-invalid': error ? (true as const) : undefined,
    'aria-describedby': error ? errorId : undefined,
    'data-autofocus': '',
    className: cn(inputClassName),
    onChange: (
      e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>,
    ) => {
      setValue(e.target.value);
      if (error) setError(null);
    },
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
      size={size}
      closeOnBackdropClick={!pending}
      closeOnEscape={!pending}
      showCloseButton={false}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
        <DialogHeader bordered={false} className="pr-5">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <DialogContent className="pt-0">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor={fieldId}
              required={required}
              hint={
                maxLength ? (
                  <span className="tabular-nums">
                    {value.length}/{maxLength}
                  </span>
                ) : undefined
              }
            >
              {label ?? title}
            </Label>

            {multiline ? (
              <Textarea
                {...fieldProps}
                rows={4}
                onKeyDown={(e) => {
                  // Ctrl/Cmd+Enter submits from a textarea.
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
            ) : (
              <Input
                {...fieldProps}
                type="text"
                autoComplete="off"
                onFocus={(e) => e.currentTarget.select()}
              />
            )}

            <FieldError id={errorId}>{error}</FieldError>
          </div>
        </DialogContent>

        <DialogFooter className="border-t-0 bg-transparent pt-1">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button type="submit" variant={destructive ? 'destructive' : 'default'} loading={pending}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

PromptDialog.displayName = 'PromptDialog';
