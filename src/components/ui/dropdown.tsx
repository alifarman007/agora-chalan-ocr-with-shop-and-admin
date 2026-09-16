'use client';

import * as React from 'react';
import { EllipsisVertical } from 'lucide-react';
import { cn } from '@/lib/cn';

type DropdownContextValue = { close: () => void };
const DropdownContext = React.createContext<DropdownContextValue | null>(null);

export interface DropdownProps {
  /**
   * The trigger. Pass a node and it is wrapped in a styled icon button, or
   * pass a render function to own the button entirely (it receives the props
   * you must spread onto your own button).
   */
  trigger?: React.ReactNode;
  children: React.ReactNode;
  /** Horizontal alignment of the menu against the trigger. */
  align?: 'start' | 'end';
  /** Vertical placement. `auto` flips up when there is no room below. */
  side?: 'bottom' | 'top' | 'auto';
  /** Accessible name for the default icon-button trigger. */
  label?: string;
  /** Class for the positioning wrapper. */
  className?: string;
  /** Class for the menu panel. */
  menuClassName?: string;
  /** Class for the default trigger button. */
  triggerClassName?: string;
  /** Minimum width of the menu panel. Defaults to `min-w-44`. */
  menuWidthClassName?: string;
  disabled?: boolean;
  /** Controlled open state (optional - the component self-manages by default). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Lightweight row-actions menu: a button, a click-outside listener and a
 * positioned `<div role="menu">`. No portal, no floating-ui - the menu is
 * absolutely positioned inside a `relative` wrapper, so keep table cells from
 * clipping it (`overflow-visible`) or use `side="top"` in the last rows.
 */
export function Dropdown({
  trigger,
  children,
  align = 'end',
  side = 'bottom',
  label = 'Open menu',
  className,
  menuClassName,
  triggerClassName,
  menuWidthClassName = 'min-w-44',
  disabled = false,
  open: controlledOpen,
  onOpenChange,
}: DropdownProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [autoFlip, setAutoFlip] = React.useState(false);
  const flipUp = side === 'top' || (side === 'auto' && autoFlip);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const close = React.useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, [setOpen]);

  // Click outside + Escape + scroll away.
  React.useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close, setOpen]);

  // Flip above the trigger when the viewport bottom is close. Measured after
  // paint, so the menu has a real height to compare against.
  React.useEffect(() => {
    if (!open || side !== 'auto') return undefined;
    const raf = requestAnimationFrame(() => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = menuRef.current?.offsetHeight ?? 220;
      setAutoFlip(rect.bottom + menuHeight + 12 > window.innerHeight && rect.top > menuHeight);
    });
    return () => cancelAnimationFrame(raf);
  }, [open, side]);

  // Roving focus with the arrow keys.
  const focusItem = (dir: 1 | -1 | 'first' | 'last') => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (dir === 'first') next = 0;
    else if (dir === 'last') next = items.length - 1;
    else next = current === -1 ? 0 : (current + dir + items.length) % items.length;
    items[next]?.focus();
  };

  const ctx = React.useMemo<DropdownContextValue>(() => ({ close }), [close]);

  const triggerProps = {
    ref: triggerRef,
    type: 'button' as const,
    'aria-haspopup': 'menu' as const,
    'aria-expanded': open,
    disabled,
    onClick: () => setOpen(!open),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        if (!open) {
          event.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => focusItem('first'));
        }
      }
    },
  };

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      <button
        {...triggerProps}
        aria-label={trigger ? undefined : label}
        className={cn(
          'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[calc(var(--radius)_-_2px)]',
          'text-muted-foreground transition-colors',
          'hover:bg-muted hover:text-foreground',
          'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          open && 'bg-muted text-foreground',
          trigger ? 'px-2 py-1.5 text-sm' : 'size-8',
          triggerClassName,
        )}
      >
        {trigger ?? <EllipsisVertical aria-hidden="true" className="size-4" />}
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-orientation="vertical"
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              focusItem(1);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              focusItem(-1);
            } else if (event.key === 'Home') {
              event.preventDefault();
              focusItem('first');
            } else if (event.key === 'End') {
              event.preventDefault();
              focusItem('last');
            } else if (event.key === 'Tab') {
              setOpen(false);
            }
          }}
          className={cn(
            'absolute z-50 overflow-hidden p-1',
            'rounded-[var(--radius)] border border-border bg-popover text-popover-foreground',
            'shadow-lg shadow-slate-900/5 dark:shadow-black/40',
            'origin-top animate-none',
            flipUp ? 'bottom-full mb-1.5 origin-bottom' : 'top-full mt-1.5',
            align === 'end' ? 'right-0' : 'left-0',
            menuWidthClassName,
            menuClassName,
          )}
        >
          <DropdownContext.Provider value={ctx}>{children}</DropdownContext.Provider>
        </div>
      ) : null}
    </div>
  );
}

export interface DropdownItemProps extends Omit<React.ComponentProps<'button'>, 'onSelect'> {
  icon?: React.ReactNode;
  /** Red text + red hover, for Delete / Reject. */
  destructive?: boolean;
  /** Keyboard shortcut or meta text shown right-aligned and muted. */
  shortcut?: React.ReactNode;
  /** Called on click; the menu closes afterwards unless `closeOnSelect` is false. */
  onSelect?: () => void;
  closeOnSelect?: boolean;
}

export function DropdownItem({
  className,
  icon,
  destructive = false,
  shortcut,
  onSelect,
  onClick,
  closeOnSelect = true,
  children,
  ...props
}: DropdownItemProps) {
  const ctx = React.useContext(DropdownContext);

  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={(event) => {
        onClick?.(event);
        onSelect?.();
        if (closeOnSelect) ctx?.close();
      }}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2.5 rounded-[calc(var(--radius)_-_3px)] px-2.5 py-2 text-left text-sm',
        'transition-colors',
        'focus-visible:outline-hidden',
        destructive
          ? 'text-red-600 hover:bg-red-50 focus:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 dark:focus:bg-red-500/10'
          : 'text-foreground hover:bg-muted focus:bg-muted',
        'disabled:pointer-events-none disabled:opacity-50',
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg:not([class*='text-'])]:text-muted-foreground",
        destructive && '[&_svg]:text-current',
        className,
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut ? (
        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
          {shortcut}
        </span>
      ) : null}
    </button>
  );
}

/** Hairline rule between groups of items. */
export function DropdownSeparator({ className, ...props }: React.ComponentProps<'div'>) {
  return <div role="separator" className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}

/** Small uppercase group heading. */
export function DropdownLabel({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}
