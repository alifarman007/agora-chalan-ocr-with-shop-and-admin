'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
  variant: TabsVariant;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabs(part: string): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error(`<${part}> must be used inside <Tabs>`);
  return ctx;
}

export type TabsVariant = 'underline' | 'pills';

export interface TabsProps extends Omit<React.ComponentProps<'div'>, 'onChange'> {
  /** Uncontrolled starting tab. */
  defaultValue?: string;
  /** Controlled value - pass with `onValueChange`. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** `underline` (default) for page-level tabs, `pills` for inline filters. */
  variant?: TabsVariant;
}

/**
 * State-only tabs - no URL sync, no router coupling. Lift `value` up if a tab
 * needs to live in the query string.
 */
export function Tabs({
  defaultValue = '',
  value: controlledValue,
  onValueChange,
  variant = 'underline',
  className,
  children,
  ...props
}: TabsProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolled;
  const baseId = React.useId();

  const setValue = React.useCallback(
    (next: string) => {
      if (!isControlled) setUncontrolled(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const ctx = React.useMemo<TabsContextValue>(
    () => ({ value, setValue, baseId, variant }),
    [value, setValue, baseId, variant],
  );

  return (
    <TabsContext.Provider value={ctx}>
      <div className={cn('flex w-full flex-col gap-4', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends React.ComponentProps<'div'> {
  /** Accessible name for the tablist, e.g. "Document sections". */
  label?: string;
  /** Stretch triggers to fill the row evenly. */
  fullWidth?: boolean;
}

export function TabsList({ className, label, fullWidth = false, ...props }: TabsListProps) {
  const { variant } = useTabs('TabsList');
  const ref = React.useRef<HTMLDivElement>(null);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const tabs = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])') ?? [],
    );
    if (tabs.length === 0) return;
    event.preventDefault();
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
    const index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : event.key === 'ArrowRight'
            ? (current + 1 + tabs.length) % tabs.length
            : (current - 1 + tabs.length) % tabs.length;
    tabs[index]?.focus();
    tabs[index]?.click();
  };

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cn(
        'flex items-center overflow-x-auto',
        variant === 'underline' && 'gap-1 border-b border-border',
        variant === 'pills' &&
          'w-fit gap-1 rounded-[var(--radius)] border border-border bg-muted/60 p-1',
        fullWidth && 'w-full [&>[role=tab]]:flex-1',
        className,
      )}
      {...props}
    />
  );
}

export interface TabsTriggerProps extends React.ComponentProps<'button'> {
  value: string;
  icon?: React.ReactNode;
  /** Small count pill after the label (e.g. number of pending documents). */
  count?: number | string;
}

export function TabsTrigger({
  className,
  value: triggerValue,
  icon,
  count,
  children,
  disabled,
  onClick,
  ...props
}: TabsTriggerProps) {
  const { value, setValue, baseId, variant } = useTabs('TabsTrigger');
  const active = value === triggerValue;

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${triggerValue}`}
      aria-selected={active}
      aria-controls={`${baseId}-panel-${triggerValue}`}
      tabIndex={active ? 0 : -1}
      disabled={disabled}
      data-state={active ? 'active' : 'inactive'}
      onClick={(event) => {
        onClick?.(event);
        setValue(triggerValue);
      }}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap',
        'text-sm font-medium transition-[color,background-color,box-shadow] duration-150',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        "[&_svg]:size-4 [&_svg]:shrink-0",
        variant === 'underline' && [
          'rounded-t-[calc(var(--radius)_-_2px)] px-3 pb-2.5 pt-2',
          '-mb-px border-b-2 border-transparent',
          active
            ? 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
            : 'text-muted-foreground hover:border-slate-300 hover:text-foreground dark:hover:border-slate-600',
        ],
        variant === 'pills' && [
          'rounded-[calc(var(--radius)_-_2px)] px-3 py-1.5',
          active
            ? 'bg-card text-foreground shadow-xs'
            : 'text-muted-foreground hover:text-foreground',
        ],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {count !== undefined ? (
        <span
          className={cn(
            'ml-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums',
            active
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export interface TabsContentProps extends React.ComponentProps<'div'> {
  value: string;
  /** Keep the panel in the DOM (hidden) when inactive - preserves state. */
  keepMounted?: boolean;
}

export function TabsContent({
  className,
  value: contentValue,
  keepMounted = false,
  children,
  ...props
}: TabsContentProps) {
  const { value, baseId } = useTabs('TabsContent');
  const active = value === contentValue;

  if (!active && !keepMounted) return null;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${contentValue}`}
      aria-labelledby={`${baseId}-tab-${contentValue}`}
      hidden={!active}
      tabIndex={0}
      className={cn(
        'min-w-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
