'use client';

import React, { useState } from 'react';
import { DeliveryChalanDocument, ColumnDefinition, LineItemRow } from '@/types/delivery-chalan';
import ConfidenceBadge from './confidence-badge';
import { Plus, Trash, X } from 'lucide-react';
import { ConfirmDialog, PromptDialog } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface LineItemsTableProps {
  document: DeliveryChalanDocument;
  onUpdate: (updates: Partial<DeliveryChalanDocument>) => void;
  readOnly?: boolean;
  className?: string;
}

const LineItemsTable: React.FC<LineItemsTableProps> = ({
  document,
  onUpdate,
  readOnly = false,
  className,
}) => {
  const { columns, rows } = document.line_items;

  // Replaces the browser prompt()/confirm() the approved app used - same wording, same outcome.
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [columnPendingDelete, setColumnPendingDelete] = useState<string | null>(null);

  // --- Row Operations ---

  const updateCell = (rowId: string, colId: string, value: string) => {
    const newRows = rows.map((row) => {
      if (row.id === rowId) {
        return {
          ...row,
          cells: { ...row.cells, [colId]: value },
        };
      }
      return row;
    });
    onUpdate({ line_items: { ...document.line_items, rows: newRows } });
  };

  const addRow = () => {
    const newRow: LineItemRow = {
      // Use timestamp to ensure unique IDs during rapid addition
      id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      cells: {},
      confidence: 1.0,
    };
    // Initialize empty cells for all columns
    columns.forEach((col) => {
      newRow.cells[col.id] = '';
    });

    onUpdate({ line_items: { ...document.line_items, rows: [...rows, newRow] } });
  };

  const removeRow = (rowId: string) => {
    // Removed window.confirm for faster editing and to avoid potential browser-specific blocking issues
    const newRows = rows.filter((r) => r.id !== rowId);
    onUpdate({ line_items: { ...document.line_items, rows: newRows } });
  };

  // --- Column Operations ---

  const addColumn = (label: string) => {
    if (!label) return;

    const id =
      label.toLowerCase().replace(/\s+/g, '_') + '_' + Math.random().toString(36).substr(2, 5);
    const newCol: ColumnDefinition = { id, label, type: 'text' };

    // Add to columns list
    const newColumns = [...columns, newCol];

    // Add empty cell to all existing rows
    const newRows = rows.map((row) => ({
      ...row,
      cells: { ...row.cells, [id]: '' },
    }));

    onUpdate({ line_items: { columns: newColumns, rows: newRows } });
  };

  const removeColumn = (colId: string) => {
    const newColumns = columns.filter((c) => c.id !== colId);
    const newRows = rows.map((row) => {
      const newCells = { ...row.cells };
      delete newCells[colId];
      return { ...row, cells: newCells };
    });

    onUpdate({ line_items: { columns: newColumns, rows: newRows } });
  };

  return (
    <div
      className={cn(
        'bg-white dark:bg-neutral-900 rounded-lg border border-slate-200 dark:border-neutral-700 shadow-xs mb-6 overflow-hidden',
        className,
      )}
    >
      <div className="bg-slate-50 dark:bg-neutral-800/50 px-4 py-3 border-b border-slate-200 dark:border-neutral-700 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-neutral-200">Line Items</h3>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setIsAddColumnOpen(true)}
            className="cursor-pointer text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center"
          >
            <Plus className="h-3 w-3 mr-1" /> Add Column
          </button>
        )}
      </div>

      <div className="overflow-x-auto pb-4">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-neutral-700">
          <thead className="bg-slate-50 dark:bg-neutral-800/50">
            <tr>
              <th
                scope="col"
                className="px-3 py-2 text-left text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase tracking-wider w-10"
              >
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className="group px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-neutral-400 uppercase tracking-wider border-r border-slate-100 dark:border-neutral-800 last:border-0 relative min-w-[120px]"
                >
                  <div className="flex items-center justify-between">
                    <input
                      readOnly={readOnly}
                      className="bg-transparent border-none p-0 text-xs font-bold uppercase tracking-wider focus:ring-0 w-full bangla-text"
                      value={col.label || ''}
                      onChange={(e) => {
                        const newCols = columns.map((c) =>
                          c.id === col.id ? { ...c, label: e.target.value } : c,
                        );
                        onUpdate({ line_items: { ...document.line_items, columns: newCols } });
                      }}
                    />
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => setColumnPendingDelete(col.id)}
                        aria-label={`Delete column ${col.label}`}
                        title="Delete Column"
                        className="cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 text-slate-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 ml-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th scope="col" className="px-3 py-2 w-16 text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-neutral-900 divide-y divide-slate-200 dark:divide-neutral-700">
            {rows.map((row, idx) => (
              <tr
                key={row.id}
                className="hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors group"
              >
                <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-400 dark:text-neutral-500 text-center">
                  {idx + 1}
                </td>
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className="px-3 py-2 whitespace-nowrap border-r border-slate-100 dark:border-neutral-800 last:border-0"
                  >
                    <input
                      type="text"
                      readOnly={readOnly}
                      className={`w-full text-sm bg-transparent dark:text-neutral-100 border-none focus:ring-1 focus:ring-blue-500 rounded-sm px-2 py-1 bangla-text ${
                        col.type === 'number' || col.type === 'currency'
                          ? 'text-right font-mono'
                          : ''
                      }`}
                      value={row.cells[col.id] || ''}
                      onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                    />
                  </td>
                ))}
                <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    {/* Only show confidence if it exists and is less than 1, to reduce clutter */}
                    {row.confidence < 0.9 && <ConfidenceBadge confidence={row.confidence} />}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRow(row.id);
                        }}
                        className="cursor-pointer p-1.5 text-slate-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-sm transition-colors"
                        title="Delete Row"
                      >
                        <Trash className="h-4 w-4 pointer-events-none" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className="px-6 py-8 text-center text-slate-400 dark:text-neutral-500 italic"
                >
                  No line items extracted. Add a row manually.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="bg-slate-50 dark:bg-neutral-800/50 border-t border-slate-200 dark:border-neutral-700 px-4 py-3">
          <button
            type="button"
            onClick={addRow}
            className="cursor-pointer flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Item Row
          </button>
        </div>
      )}

      <PromptDialog
        open={isAddColumnOpen}
        onOpenChange={setIsAddColumnOpen}
        title="Add Column"
        label="Enter new column name:"
        placeholder="Enter new column name:"
        confirmLabel="Add Column"
        onSubmit={(value: string) => {
          addColumn(value);
          setIsAddColumnOpen(false);
        }}
      />

      <ConfirmDialog
        open={columnPendingDelete !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setColumnPendingDelete(null);
        }}
        title="Delete Column"
        description="Delete this column and all its data?"
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (columnPendingDelete) removeColumn(columnPendingDelete);
          setColumnPendingDelete(null);
        }}
      />
    </div>
  );
};

export default LineItemsTable;
