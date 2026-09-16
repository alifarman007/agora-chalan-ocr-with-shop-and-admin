'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from 'lucide-react';
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';

export type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

/**
 * Pre-styled sonner `<Toaster />`. Mount it once, in the root layout, below
 * `{children}`. Everything is driven by our CSS variables so toasts follow
 * the next-themes light/dark class automatically.
 */
export function Toaster({ position = 'top-right', ...props }: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      theme={(resolvedTheme as ToasterProps['theme']) ?? 'system'}
      position={position}
      offset={16}
      gap={10}
      visibleToasts={4}
      closeButton
      icons={{
        success: <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" />,
        error: <CircleAlert className="size-4 text-red-600 dark:text-red-400" />,
        warning: <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />,
        info: <Info className="size-4 text-blue-600 dark:text-blue-400" />,
        loading: <LoaderCircle className="size-4 animate-spin text-muted-foreground" />,
      }}
      toastOptions={{
        classNames: {
          toast: [
            'group flex w-full items-start gap-3 p-4',
            'rounded-[var(--radius)] border border-border bg-popover text-popover-foreground',
            'shadow-lg shadow-slate-900/10 dark:shadow-black/40',
          ].join(' '),
          title: 'text-sm font-semibold leading-tight text-foreground',
          description: 'mt-1 text-sm leading-relaxed text-muted-foreground',
          actionButton: [
            'cursor-pointer rounded-[calc(var(--radius)_-_2px)] bg-indigo-600 px-2.5 py-1',
            'text-xs font-medium text-white transition-colors hover:bg-indigo-700',
          ].join(' '),
          cancelButton: [
            'cursor-pointer rounded-[calc(var(--radius)_-_2px)] bg-muted px-2.5 py-1',
            'text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
          ].join(' '),
          closeButton:
            'cursor-pointer border-border bg-card text-muted-foreground hover:text-foreground',
          icon: 'mt-0.5 shrink-0',
          success: 'border-emerald-200/80 dark:border-emerald-500/25',
          error: 'border-red-200/80 dark:border-red-500/25',
          warning: 'border-amber-200/80 dark:border-amber-500/25',
          info: 'border-blue-200/80 dark:border-blue-500/25',
        },
      }}
      {...props}
    />
  );
}

type ToastOptions = Parameters<typeof sonnerToast>[1];

/**
 * Thin wrapper over sonner so call sites never import sonner directly and we
 * can restyle or swap the library in one place.
 *
 *   toast.success('Chalan approved')
 *   toast.error('Upload failed', { description: err.message })
 *   toast.promise(save(), { loading: 'Saving…', success: 'Saved', error: 'Failed' })
 */
export const toast = {
  success: (message: React.ReactNode, options?: ToastOptions) =>
    sonnerToast.success(message, options),
  error: (message: React.ReactNode, options?: ToastOptions) => sonnerToast.error(message, options),
  info: (message: React.ReactNode, options?: ToastOptions) => sonnerToast.info(message, options),
  warning: (message: React.ReactNode, options?: ToastOptions) =>
    sonnerToast.warning(message, options),
  message: (message: React.ReactNode, options?: ToastOptions) => sonnerToast(message, options),
  loading: (message: React.ReactNode, options?: ToastOptions) =>
    sonnerToast.loading(message, options),
  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,
  custom: sonnerToast.custom,
};

export type Toast = typeof toast;
