import * as React from 'react';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface TableProps extends React.ComponentProps<'table'> {
  /** Pins `<thead>` cells while the body scrolls. */
  stickyHeader?: boolean;
  /** Alternating row tint. Off by default — most of our tables are dense. */
  zebra?: boolean;
  /** Tighter row height for line-item tables. */
  dense?: boolean;
  /** Class for the horizontal-scroll wrapper (set a max-height here for sticky). */
  containerClassName?: string;
  /** Renders without the scroll wrapper (when the caller owns the scroll box). */
  unwrapped?: boolean;
}

export function Table({
  className,
  containerClassName,
  stickyHeader = false,
  zebra = false,
  dense = false,
  unwrapped = false,
  ...props
}: TableProps) {
  const table = (
    <table
      data-sticky={stickyHeader ? '' : undefined}
      data-zebra={zebra ? '' : undefined}
      data-dense={dense ? '' : undefined}
      className={cn(
        'w-full caption-bottom border-collapse text-sm',
        // sticky header, driven by the data attribute so no context is needed
        '[&[data-sticky]_thead_th]:sticky [&[data-sticky]_thead_th]:top-0 [&[data-sticky]_thead_th]:z-10',
        '[&[data-sticky]_thead_th]:bg-muted [&[data-sticky]_thead_th]:shadow-[inset_0_-1px_0_0_var(--border)]',
        // zebra rows
        '[&[data-zebra]_tbody_tr:nth-child(even)]:bg-muted/40',
        // density
        '[&[data-dense]_td]:py-1.5 [&[data-dense]_th]:py-2',
        className,
      )}
      {...props}
    />
  );

  if (unwrapped) return table;

  return (
    <div
      className={cn(
        'relative w-full overflow-x-auto overscroll-x-contain',
        'rounded-[var(--radius)] border border-border bg-card',
        containerClassName,
      )}
    >
      {table}
    </div>
  );
}

export function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      className={cn('bg-muted/60 [&_tr]:border-b [&_tr]:border-border', className)}
      {...props}
    />
  );
}

export type TableBodyProps = React.ComponentProps<'tbody'>;

export function TableBody({ className, ...props }: TableBodyProps) {
  return (
    <tbody
      className={cn('[&_tr:last-child]:border-0 divide-y divide-border', className)}
      {...props}
    />
  );
}

export function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      className={cn(
        'border-t border-border bg-muted/60 font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  );
}

export interface TableRowProps extends React.ComponentProps<'tr'> {
  /** Adds hover/pointer affordance for clickable rows. */
  interactive?: boolean;
  /** Persistent selected tint (checkbox selection, focused row). */
  selected?: boolean;
}

export function TableRow({ className, interactive = false, selected = false, ...props }: TableRowProps) {
  return (
    <tr
      data-selected={selected ? '' : undefined}
      aria-selected={selected || undefined}
      className={cn(
        'border-b border-border transition-colors',
        'hover:bg-muted/50',
        interactive &&
          'cursor-pointer focus-within:bg-muted/60 focus-visible:outline-hidden',
        selected && 'bg-indigo-50/70 hover:bg-indigo-50 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/15',
        className,
      )}
      {...props}
    />
  );
}

export interface TableHeadProps extends React.ComponentProps<'th'> {
  /** Right-align (use for money / quantity columns). */
  numeric?: boolean;
  /** Renders a sort button and the matching `aria-sort` value. */
  sortable?: boolean;
  /** Current sort of this column. `false` = sortable but not the active sort. */
  sortDirection?: 'asc' | 'desc' | false;
  /** Called when the sort button is pressed. Requires `sortable`. */
  onSort?: () => void;
}

export function TableHead({
  className,
  numeric = false,
  sortable = false,
  sortDirection = false,
  onSort,
  children,
  ...props
}: TableHeadProps) {
  const ariaSort: React.AriaAttributes['aria-sort'] = sortable
    ? sortDirection === 'asc'
      ? 'ascending'
      : sortDirection === 'desc'
        ? 'descending'
        : 'none'
    : undefined;

  const SortIcon =
    sortDirection === 'asc' ? ChevronUp : sortDirection === 'desc' ? ChevronDown : ChevronsUpDown;

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={cn(
        'h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        numeric && 'text-right',
        className,
      )}
      {...props}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            'inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-semibold uppercase tracking-wide',
            'transition-colors hover:text-foreground',
            'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            sortDirection && 'text-foreground',
            numeric && 'flex-row-reverse',
          )}
        >
          {children}
          <SortIcon aria-hidden="true" className="size-3.5 opacity-70" />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export interface TableCellProps extends React.ComponentProps<'td'> {
  /** Right-aligned tabular figures. */
  numeric?: boolean;
  /** Truncate with an ellipsis (pair with a `title`). */
  truncate?: boolean;
}

export function TableCell({ className, numeric = false, truncate = false, ...props }: TableCellProps) {
  return (
    <td
      className={cn(
        'px-3 py-2.5 align-middle text-sm text-foreground',
        numeric && 'text-right tabular-nums',
        truncate && 'max-w-[1px] truncate',
        className,
      )}
      {...props}
    />
  );
}

export function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return <caption className={cn('mt-3 px-3 text-xs text-muted-foreground', className)} {...props} />;
}

/** Full-width cell for "no rows" / loading messages inside a table body. */
export interface TableEmptyProps extends React.ComponentProps<'td'> {
  colSpan: number;
}

export function TableEmpty({ className, colSpan, children, ...props }: TableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan} className={cn('px-3 py-10 text-center', className)} {...props}>
        {children}
      </td>
    </tr>
  );
}
