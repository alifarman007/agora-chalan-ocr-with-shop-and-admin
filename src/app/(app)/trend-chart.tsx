'use client'

import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Point = { day: string; status: string; value: number }

const SERIES = [
  { key: 'approved', label: 'Approved', color: 'var(--chart-2)' },
  { key: 'pending_approval', label: 'Waiting', color: 'var(--chart-3)' },
  { key: 'rejected', label: 'Rejected', color: 'var(--chart-4)' },
  { key: 'other', label: 'In progress', color: 'var(--chart-1)' },
] as const

/** Fills in the days with no documents, so the line does not lie about gaps. */
function buildRows(data: Point[], from: string, to: string) {
  const byDay = new Map<string, Record<string, number>>()
  for (const p of data) {
    const bucket =
      p.status === 'approved' || p.status === 'pending_approval' || p.status === 'rejected'
        ? p.status
        : 'other'
    const row = byDay.get(p.day) ?? { approved: 0, pending_approval: 0, rejected: 0, other: 0 }
    row[bucket] = (row[bucket] ?? 0) + p.value
    byDay.set(p.day, row)
  }

  type Row = { day: string; label: string; approved: number; pending_approval: number; rejected: number; other: number }
  const rows: Row[] = []
  const start = new Date(from + 'T00:00:00Z')
  const end = new Date(to + 'T00:00:00Z')
  // Cap at a year so a silly date range cannot lock the browser up.
  for (let d = start, i = 0; d <= end && i < 400; d = new Date(d.getTime() + 86400000), i++) {
    const key = d.toISOString().slice(0, 10)
    const row = byDay.get(key) ?? { approved: 0, pending_approval: 0, rejected: 0, other: 0 }
    rows.push({
      approved: row.approved ?? 0,
      pending_approval: row.pending_approval ?? 0,
      rejected: row.rejected ?? 0,
      other: row.other ?? 0,
      day: key,
      label: new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
        .format(d),
    })
  }
  return rows
}

export function TrendChart({ data, from, to }: { data: Point[]; from: string; to: string }) {
  const rows = useMemo(() => buildRows(data, from, to), [data, from, to])
  const hasAny = rows.some((r) => SERIES.some((s) => r[s.key] > 0))

  if (!hasAny) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No documents in this period yet.
      </div>
    )
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            {SERIES.map((s) => (
              <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--popover-foreground)',
            }}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          />
          {SERIES.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stackId="1"
              stroke={s.color}
              fill={`url(#fill-${s.key})`}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
