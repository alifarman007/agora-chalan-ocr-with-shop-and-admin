'use client'

import { useState } from 'react'
import {
  CircleCheck,
  CircleX,
  CloudUpload,
  FileText,
  LoaderCircle,
  PenLine,
  Send,
  TriangleAlert,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui'
import { formatDhaka, formatNumber, formatUSD } from '@/lib/format'
import { cn } from '@/lib/cn'

export type HistoryEntry = {
  id: string
  eventType: string
  note: string | null
  actorName: string | null
  createdAt: string
  details: Record<string, unknown> | null
}

const SPECS: Record<
  string,
  { label: string; icon: typeof CloudUpload; tone: string }
> = {
  uploaded: { label: 'Uploaded', icon: CloudUpload, tone: 'text-muted-foreground bg-muted' },
  ocr_started: { label: 'Reading started', icon: LoaderCircle, tone: 'text-brand bg-brand/10' },
  ocr_succeeded: { label: 'Reading finished', icon: FileText, tone: 'text-brand bg-brand/10' },
  ocr_failed: { label: 'Reading failed', icon: TriangleAlert, tone: 'text-destructive bg-destructive/10' },
  draft_saved: { label: 'Edited', icon: PenLine, tone: 'text-muted-foreground bg-muted' },
  submitted: { label: 'Submitted for approval', icon: Send, tone: 'text-warning-foreground bg-warning/20' },
  resubmitted: { label: 'Sent again', icon: Send, tone: 'text-warning-foreground bg-warning/20' },
  approved: { label: 'Approved', icon: CircleCheck, tone: 'text-success bg-success/10' },
  rejected: { label: 'Sent back', icon: CircleX, tone: 'text-destructive bg-destructive/10' },
  deleted: { label: 'Deleted', icon: CircleX, tone: 'text-destructive bg-destructive/10' },
}

function summarise(entry: HistoryEntry): string | null {
  const d = entry.details
  if (!d) return null
  if (entry.eventType === 'ocr_succeeded') {
    const parts: string[] = []
    if (typeof d.inputTokens === 'number' && typeof d.outputTokens === 'number') {
      parts.push(formatNumber(d.inputTokens + d.outputTokens) + ' tokens')
    }
    if (typeof d.costUsd === 'number') parts.push(formatUSD(d.costUsd))
    if (typeof d.durationMs === 'number') parts.push(Math.round(d.durationMs / 1000) + 's')
    return parts.join(' · ') || null
  }
  if (entry.eventType === 'ocr_failed') {
    return typeof d.reason === 'string' ? d.reason.replace(/_/g, ' ') : null
  }
  if (entry.eventType === 'submitted' || entry.eventType === 'resubmitted') {
    const n = d.correctionCount
    if (typeof n === 'number') return n + (n === 1 ? ' correction' : ' corrections')
  }
  return null
}

export function HistoryTimeline({ entries }: { entries: HistoryEntry[] }) {
  const [expanded, setExpanded] = useState(false)
  // Noisy autosave rows are collapsed by default so the real decisions stand out.
  const important = entries.filter((e) => e.eventType !== 'draft_saved')
  const shown = expanded ? entries : important

  if (entries.length === 0) return null

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">History</h2>
          {entries.length !== important.length && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {expanded ? 'Hide edits' : 'Show every edit'}
            </button>
          )}
        </div>

        <ol className="flex flex-col gap-0">
          {shown.map((entry, index) => {
            const spec = SPECS[entry.eventType] ?? {
              label: entry.eventType,
              icon: FileText,
              tone: 'text-muted-foreground bg-muted',
            }
            const Icon = spec.icon
            const detail = summarise(entry)
            const last = index === shown.length - 1
            return (
              <li key={entry.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', spec.tone)}>
                    <Icon className="size-4" />
                  </span>
                  {!last && <span className="w-px flex-1 bg-border" />}
                </div>
                <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-5')}>
                  <p className="text-sm font-medium">{spec.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.actorName ?? 'System'} · {formatDhaka(entry.createdAt, 'short')}
                    {detail && ' · ' + detail}
                  </p>
                  {entry.note && (
                    <p className="mt-1.5 rounded-md border border-border bg-muted/40 p-2 text-sm bangla-text">
                      {entry.note}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
