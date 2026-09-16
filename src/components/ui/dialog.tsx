'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './button';

/* -------------------------------------------------------------------------- */
/*  Context                                                                     */
/* -------------------------------------------------------------------------- */

type DialogContextValue = {
  titleId: string;
  descriptionId: string;
  close: () => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

/** Lets any descendant (e.g. a Cancel button) close the dialog. */
export function useDialog(): DialogContextValue {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside a <Dialog>');
  return ctx;
}

/* -------------------------------------------------------------------------- */
/*  Dialog                                                                      */
/* -------------------------------------------------------------------------- */

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const SIZES: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[min(72rem,calc(100vw-2rem))]',
};

export interface DialogProps {
  open: boolean;
  /** Called with `false` on Escape, backdrop click or the close button. */
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
  size?: DialogSize;
  /** Show the X button in the top-right corner. */
  showCloseButton?: boolean;
  /** Set false to keep a click on the dim area from closing the dialog. */
  closeOnBackdropClick?: boolean;
  /** Set false for destructive flows that must be dismissed deliberately. */
  closeOnEscape?: boolean;
  /** Accessible name when no `DialogTitle` is rendered. */
  ariaLabel?: string;
  /** Keep children mounted while closed (preserves scroll + form state). */
  keepMounted?: boolean;
  /** Class for the panel surface. */
  className?: string;
  /** Class for the backdrop / positioning layer. */
  backdropClassName?: string;
}

/**
 * Modal built on the native `<dialog>` element - no Radix, no portal, no
 * scroll-lock hacks. `showModal()` gives us the top layer, the inert
 * background, the real focus trap and Escape handling for free; this wrapper
 * adds token-based styling, backdrop-click dismissal and focus restoration.
 */
export function Dialog({
  open,
  onOpenChange,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  ariaLabel,
  keepMounted = false,
  className,
  backdropClassName,
}: DialogProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);

  const reactId = React.useId();
  const titleId = `${reactId}-title`;
  const descriptionId = `${reactId}-description`;

  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);

  // Open / close the native dialog in step with the `open` prop.
  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    if (open) {
      if (!el.open) {
        restoreFocusRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        el.showModal();
      }
      const raf = requestAnimationFrame(() => {
        // The enter transition is a DOM attribute rather than React state:
        // it must flip one frame *after* the element joins the top layer.
        panelRef.current?.setAttribute('data-state', 'open');
        // Prefer an explicit [data-autofocus], then the first real control,
        // then the panel itself so focus never escapes to the page behind.
        const panel = panelRef.current;
        const target =
          panel?.querySelector<HTMLElement>('[data-autofocus]') ??
          panel?.querySelector<HTMLElement>(
            'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]):not([data-dialog-close]), [href], [tabindex]:not([tabindex="-1"])',
          ) ??
          panel;
        target?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }

    panelRef.current?.setAttribute('data-state', 'closed');
    if (el.open) el.close();
    return undefined;
  }, [open]);

  // Give focus back to whatever opened the dialog.
  React.useEffect(() => {
    if (open) return undefined;
    const previous = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (previous && document.contains(previous)) {
      previous.focus();
    }
    return undefined;
  }, [open]);

  // Unmount safety: never leave a dialog in the top layer.
  React.useEffect(() => {
    const el = dialogRef.current;
    return () => {
      if (el?.open) el.close();
    };
  }, []);

  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    // `cancel` fires on Escape. Always prevent the default close so that
    // React state stays the source of truth.
    event.preventDefault();
    if (closeOnEscape) close();
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (!closeOnBackdropClick) return;
    if (event.target !== dialogRef.current) return;
    // Guard against <select> / drag interactions reporting the dialog as target.
    const rect = panelRef.current?.getBoundingClientRect();
    if (
      rect &&
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    ) {
      return;
    }
    close();
  };

  const ctx = React.useMemo<DialogContextValue>(
    () => ({ titleId, descriptionId, close }),
    [titleId, descriptionId, close],
  );

  return (
    <dialog
      ref={dialogRef}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : titleId}
      onCancel={handleCancel}
      onClose={() => {
        if (open) close();
      }}
      onClick={handleBackdropClick}
      className={cn(
        // reset the UA styles of <dialog>
        'm-0 h-full max-h-none w-full max-w-none bg-transparent p-4 text-foreground',
        'open:flex open:items-center open:justify-center',
        'backdrop:bg-slate-950/50 backdrop:backdrop-blur-[2px]',
        backdropClassName,
      )}
    >
      <div
        ref={panelRef}
        role="document"
        tabIndex={-1}
        data-state="closed"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'relative flex max-h-[85vh] w-full flex-col overflow-hidden',
          'rounded-[calc(var(--radius)_+_4px)] border border-border bg-card text-card-foreground',
          'shadow-2xl shadow-slate-900/10 outline-hidden dark:shadow-black/40',
          'transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
          'data-[state=closed]:scale-[0.97] data-[state=closed]:opacity-0',
          'data-[state=open]:scale-100 data-[state=open]:opacity-100',
          SIZES[size],
          className,
        )}
      >
        <DialogContext.Provider value={ctx}>
          {showCloseButton ? (
            <button
              type="button"
              data-dialog-close=""
              onClick={close}
              aria-label="Close dialog"
              className={cn(
                'absolute right-3 top-3 z-10 inline-flex size-8 cursor-pointer items-center justify-center',
                'rounded-[calc(var(--radius)_-_2px)] text-muted-foreground transition-colors',
                'hover:bg-muted hover:text-foreground',
                'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
              )}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
          {open || keepMounted ? children : null}
        </DialogContext.Provider>
      </div>
    </dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  Parts                                                                       */
/* -------------------------------------------------------------------------- */

export interface DialogHeaderProps extends React.ComponentProps<'div'> {
  /** Adds a hairline rule under the header. */
  bordered?: boolean;
  /** Decorative icon shown to the left of the title. */
  icon?: React.ReactNode;
}

export function DialogHeader({
  className,
  bordered = true,
  icon,
  children,
  ...props
}: DialogHeaderProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-start gap-3 px-5 pb-4 pt-5 pr-14',
        bordered && 'border-b border-border',
        className,
      )}
      {...props}
    >
      {icon ? <div className="mt-0.5 shrink-0 [&_svg]:size-5">{icon}</div> : null}
      <div className="flex min-w-0 flex-col gap-1.5">{children}</div>
    </div>
  );
}

export function DialogTitle({ className, id, ...props }: React.ComponentProps<'h2'>) {
  const ctx = React.useContext(DialogContext);
  return (
    <h2
      id={id ?? ctx?.titleId}
      className={cn(
        'text-base font-semibold leading-tight tracking-tight text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function DialogDescription({ className, id, ...props }: React.ComponentProps<'p'>) {
  const ctx = React.useContext(DialogContext);
  return (
    <p
      id={id ?? ctx?.descriptionId}
      className={cn('text-sm leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  );
}

export interface DialogContentProps extends React.ComponentProps<'div'> {
  /** Remove the default padding for full-bleed content (image previews). */
  flush?: boolean;
}

/** The scrollable body of the dialog. */
export function DialogContent({ className, flush = false, ...props }: DialogContentProps) {
  return (
    <div
      className={cn(
        'min-h-0 flex-1 overflow-y-auto overscroll-contain',
        flush ? 'p-0' : 'px-5 py-4',
        className,
      )}
      {...props}
    />
  );
}

export interface DialogFooterProps extends React.ComponentProps<'div'> {
  /** `end` (default) right-aligns, `between` pushes the first child left. */
  align?: 'end' | 'between' | 'start';
}

export function DialogFooter({ className, align = 'end', ...props }: DialogFooterProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-muted/40 px-5 py-4',
        align === 'end' && 'justify-end',
        align === 'between' && 'justify-between',
        align === 'start' && 'justify-start',
        className,
      )}
      {...props}
    />
  );
}

/** A button that closes the surrounding dialog. Renders its children as-is. */
export type DialogCloseProps = React.ComponentProps<typeof Button>;

export function DialogClose({ onClick, children = 'Cancel', ...props }: DialogCloseProps) {
  const { close } = useDialog();
  return (
    <Button
      variant="outline"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) close();
      }}
      {...props}
    >
      {children}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/*  ConfirmDialog                                                               */
/* -------------------------------------------------------------------------- */

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button + red icon halo. */
  destructive?: boolean;
  /**
   * Runs on confirm. If it returns a promise the button shows a spinner and
   * the dialog stays open until it settles; it closes on success and stays
   * open on rejection so the caller can surface the error.
   */
  onConfirm: () => void | Promise<unknown>;
  /** Icon in the halo. Defaults to a warning triangle / question mark. */
  icon?: React.ReactNode;
  /** Extra content between the description and the footer. */
  children?: React.ReactNode;
  size?: DialogSize;
}

/**
 * Drop-in replacement for `window.confirm()` - same one-question shape, but
 * themed, keyboard accessible and able to await an async action.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  icon,
  children,
  size = 'sm',
}: ConfirmDialogProps) {
  const [pending, setPending] = React.useState(false);

  const handleConfirm = async () => {
    try {
      const result = onConfirm();
      if (result instanceof Promise) {
        setPending(true);
        await result;
      }
      setPending(false);
      onOpenChange(false);
    } catch {
      setPending(false);
      // Left open on purpose: the caller shows the error (toast, field, ...).
    }
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
      <DialogHeader
        bordered={false}
        icon={
          icon ? (
            <span
              className={cn(
                'flex size-9 items-center justify-center rounded-full',
                destructive
                  ? 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400'
                  : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400',
              )}
            >
              {icon}
            </span>
          ) : undefined
        }
        className="pr-5"
      >
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
      </DialogHeader>

      {children ? <DialogContent className="pt-0">{children}</DialogContent> : null}

      <DialogFooter className="border-t-0 bg-transparent pt-1">
        <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'destructive' : 'default'}
          loading={pending}
          onClick={handleConfirm}
          data-autofocus=""
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
