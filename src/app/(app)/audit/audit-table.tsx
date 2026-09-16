'use client'

import * as React from 'react'
import { ChevronDown, ChevronRight, ScrollText } from 'lucide-react'
import { formatDhaka, timeAgo } from '@/lib/format'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { actionLabel, changeLines } from './details'

export type AuditRowView = {
  id: number
  createdAt: string
  action: string
  targetType: string | null
  targetId: string | null
  details: unknown
  actorName: string | null
  actorEmail: string | null
}

function Target({ row }: { row: AuditRowView }) {
  if (!row.targetType && !row.targetId) return <span className="text-muted-foreground">—</span>
  return (
    <span className="block min-w-0">
      <span className="block text-sm text-foreground">{row.targetType ?? '—'}</span>
      {row.targetId && (
        <span className="block truncate font-mono text-[11px] text-muted-foreground">
          {row.targetId}
        </span>
      )}
    </span>
  )
}

function Changes({ row }: { row: AuditRowView }) {
  const lines = changeLines(row.details, { targetType: row.targetType, targetId: row.targetId })
  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing was recorded for this entry.</p>
  }
  return (
    <ul className="space-y-1">
      {lines.map((line, i) => (
        <li key={i} className="text-sm">
          <span className="font-medium text-foreground">{line.label}:</span>{' '}
          {line.text !== undefined ? (
            <span className="text-muted-foreground">{line.text}</span>
          ) : (
            <>
              <span className="text-muted-foreground line-through">{line.from}</span>
              <span className="mx-1 text-muted-foreground" aria-label="changed to">
                →
              </span>
              <span className="text-foreground">{line.to}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

export function AuditTable({ rows }: { rows: AuditRowView[] }) {
  const [open, setOpen] = React.useState<Set<number>>(() => new Set())

  function toggle(id: number) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<ScrollText className="size-6" aria-hidden="true" />}
        title="No activity to show"
        description="Nothing matches these filters. Try a wider date range, or clear the search."
      />
    )
  }

  return (
    <>
      {/* Phones: one card per entry, because a five-column table does not fit. */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => {
          const isOpen = open.has(row.id)
          return (
            <li key={row.id} className="rounded-[var(--radius)] border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{actionLabel(row.action)}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.actorName ?? 'Unknown user'} · {formatDhaka(row.createdAt, 'short')}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  aria-expanded={isOpen}
                  aria-label={isOpen ? 'Hide details' : 'Show details'}
                  onClick={() => toggle(row.id)}
                >
                  {isOpen ? (
                    <ChevronDown className="size-4" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                <Target row={row} />
              </div>
              {isOpen && (
                <div className="mt-3 border-t border-border pt-3">
                  <Changes row={row} />
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="hidden md:block">
        <Table stickyHeader containerClassName="bg-card">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <span className="sr-only">Show details</span>
              </TableHead>
              <TableHead className="min-w-[11rem]">When</TableHead>
              <TableHead className="min-w-[12rem]">Who</TableHead>
              <TableHead className="min-w-[11rem]">Action</TableHead>
              <TableHead className="min-w-[12rem]">Target</TableHead>
              <TableHead>What changed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableEmpty colSpan={6}>No activity to show.</TableEmpty>
              </TableRow>
            )}
            {rows.map((row) => {
              const isOpen = open.has(row.id)
              const lines = changeLines(row.details, {
                targetType: row.targetType,
                targetId: row.targetId,
              })
              const summary =
                lines.length === 0
                  ? 'No details'
                  : lines.length === 1
                    ? `${lines[0].label}${lines[0].text !== undefined ? '' : ' changed'}`
                    : `${lines.length} changes`

              return (
                <React.Fragment key={row.id}>
                  <TableRow>
                    <TableCell>
                      <button
                        type="button"
                        className="rounded-sm p-1 text-muted-foreground hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                        aria-expanded={isOpen}
                        aria-controls={`audit-details-${row.id}`}
                        aria-label={isOpen ? 'Hide details' : 'Show details'}
                        onClick={() => toggle(row.id)}
                      >
                        {isOpen ? (
                          <ChevronDown className="size-4" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="size-4" aria-hidden="true" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className="block text-sm text-foreground">
                        {formatDhaka(row.createdAt)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {timeAgo(row.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {row.actorName ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar name={row.actorName} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-foreground">
                              {row.actorName}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {row.actorEmail ?? ''}
                            </span>
                          </span>
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">System</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" title={row.action}>
                        {actionLabel(row.action)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Target row={row} />
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="text-left text-sm text-blue-600 underline-offset-4 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring dark:text-blue-400"
                        onClick={() => toggle(row.id)}
                      >
                        {isOpen ? 'Hide details' : summary}
                      </button>
                    </TableCell>
                  </TableRow>

                  {isOpen && (
                    <TableRow>
                      <TableCell colSpan={6} id={`audit-details-${row.id}`} className="bg-muted/40">
                        <Changes row={row} />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
