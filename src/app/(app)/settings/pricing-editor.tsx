'use client'

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/** One model's price, plus anything else the stored row carried. */
export type PriceRow = {
  /** Stable key for React, so renaming a model does not lose focus. */
  rowId: string
  model: string
  input: string
  output: string
  /** `until` / `then` are kept as they were. We never edit them here. */
  rest: Record<string, unknown>
}

type StoredPrice = {
  input_usd_per_1m?: unknown
  output_usd_per_1m?: unknown
  until?: string | null
  then?: { input_usd_per_1m: number; output_usd_per_1m: number } | null
}

let counter = 0
function nextId() {
  counter += 1
  return `price-${counter}`
}

export function pricingToRows(value: unknown): PriceRow[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value as Record<string, StoredPrice>).map(([model, price]) => {
    const { input_usd_per_1m, output_usd_per_1m, ...rest } = price ?? {}
    return {
      rowId: nextId(),
      model,
      input: String(input_usd_per_1m ?? 0),
      output: String(output_usd_per_1m ?? 0),
      rest: rest as Record<string, unknown>,
    }
  })
}

export function rowsToPricing(rows: PriceRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const row of rows) {
    const model = row.model.trim()
    if (!model) continue
    out[model] = {
      ...row.rest,
      input_usd_per_1m: Number(row.input),
      output_usd_per_1m: Number(row.output),
    }
  }
  return out
}

/** Returns a plain-English problem, or null when the table is fine. */
export function validateRows(rows: PriceRow[]): string | null {
  const seen = new Set<string>()
  for (const row of rows) {
    const model = row.model.trim()
    if (!model) return 'Every row needs a model name.'
    if (seen.has(model)) return `The model "${model}" is listed twice.`
    seen.add(model)
    if (!Number.isFinite(Number(row.input)) || Number(row.input) < 0) {
      return `The input price for "${model}" must be a number.`
    }
    if (!Number.isFinite(Number(row.output)) || Number(row.output) < 0) {
      return `The output price for "${model}" must be a number.`
    }
  }
  return null
}

function futureNote(rest: Record<string, unknown>): string | null {
  const until = typeof rest.until === 'string' ? rest.until : null
  const then = rest.then as { input_usd_per_1m?: number; output_usd_per_1m?: number } | null
  if (!until || !then) return null
  return `From ${until} this model costs $${then.input_usd_per_1m} / $${then.output_usd_per_1m}.`
}

export function PricingEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: PriceRow[]
  onChange: (rows: PriceRow[]) => void
  disabled?: boolean
}) {
  function update(rowId: string, patch: Partial<PriceRow>) {
    onChange(rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)))
  }

  return (
    <div className="space-y-2">
      <Table dense containerClassName="bg-card">
        <TableHeader>
          <TableRow>
            <TableHead>Model</TableHead>
            <TableHead numeric>USD per 1M input</TableHead>
            <TableHead numeric>USD per 1M output</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Remove</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableEmpty colSpan={4}>No models listed yet.</TableEmpty>
            </TableRow>
          )}
          {rows.map((row) => {
            const note = futureNote(row.rest)
            return (
              <TableRow key={row.rowId}>
                <TableCell>
                  <Input
                    inputSize="sm"
                    aria-label="Model name"
                    value={row.model}
                    disabled={disabled}
                    onChange={(e) => update(row.rowId, { model: e.target.value })}
                    className="min-w-[10rem] font-mono text-xs"
                  />
                  {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
                </TableCell>
                <TableCell numeric>
                  <Input
                    inputSize="sm"
                    type="number"
                    step="0.01"
                    min="0"
                    aria-label="US dollars per one million input tokens"
                    value={row.input}
                    disabled={disabled}
                    onChange={(e) => update(row.rowId, { input: e.target.value })}
                    className="w-28 text-right"
                  />
                </TableCell>
                <TableCell numeric>
                  <Input
                    inputSize="sm"
                    type="number"
                    step="0.01"
                    min="0"
                    aria-label="US dollars per one million output tokens"
                    value={row.output}
                    disabled={disabled}
                    onChange={(e) => update(row.rowId, { output: e.target.value })}
                    className="w-28 text-right"
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    aria-label={`Remove ${row.model || 'this model'}`}
                    onClick={() => onChange(rows.filter((r) => r.rowId !== row.rowId))}
                  >
                    <Trash2 className="size-4 text-muted-foreground" aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        leftIcon={<Plus className="size-4" aria-hidden="true" />}
        onClick={() =>
          onChange([...rows, { rowId: nextId(), model: '', input: '0', output: '0', rest: {} }])
        }
      >
        Add a model
      </Button>
    </div>
  )
}
