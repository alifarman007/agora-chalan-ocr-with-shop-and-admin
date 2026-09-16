import Link from 'next/link'
import { FileText } from 'lucide-react'
import {
  EmptyState,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { formatDhaka, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { DocumentListRow } from '@/server/queries/documents'
import type { DocumentStatus } from '@/db/schema'

export type DocumentTableVariant = 'all' | 'pending' | 'approved'

export function DocumentTable({
  rows,
  variant = 'all',
  currentUserId,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: {
  rows: DocumentListRow[]
  variant?: DocumentTableVariant
  currentUserId?: string
  emptyTitle: string
  emptyDescription: string
  emptyAction?: React.ReactNode
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="size-6" />}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    )
  }

  const timeLabel = variant === 'pending' ? 'Waiting' : variant === 'approved' ? 'Approved' : 'Uploaded'

  return (
    <Table containerClassName="rounded-xl border border-border bg-card">
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">Doc</TableHead>
          <TableHead>Chalan</TableHead>
          <TableHead className="hidden sm:table-cell">Shop</TableHead>
          <TableHead className="hidden lg:table-cell">
            {variant === 'all' ? 'Uploaded by' : 'Submitted by'}
          </TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">{timeLabel}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const when =
            variant === 'pending'
              ? row.submittedAt
              : variant === 'approved'
                ? row.reviewedAt
                : row.createdAt
          const isOwn = currentUserId && row.submittedByUserId === currentUserId
          const waitedLong =
            variant === 'pending' &&
            row.submittedAt &&
            Date.now() - new Date(row.submittedAt).getTime() > 48 * 3600_000

          return (
            <TableRow key={row.id} className="group">
              <TableCell>
                <Link href={`/documents/${row.id}`} tabIndex={-1} aria-hidden>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/files/${row.id}/thumb`}
                    alt=""
                    loading="lazy"
                    className="size-10 rounded-sm border border-border object-cover"
                  />
                </Link>
              </TableCell>
              <TableCell>
                <Link
                  href={`/documents/${row.id}`}
                  className="block font-medium hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring bangla-text"
                >
                  {row.chalanNumber || row.originalFilename}
                </Link>
                <span className="block text-xs text-muted-foreground sm:hidden">
                  {row.shopName}
                </span>
                {isOwn && variant === 'pending' && (
                  <span className="text-[11px] font-medium text-warning-foreground">
                    you submitted this
                  </span>
                )}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <span className="block text-sm">{row.shopName}</span>
                <span className="block text-xs text-muted-foreground">{row.shopCode}</span>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                {variant === 'all'
                  ? (row.uploadedByName ?? '—')
                  : (row.submittedByName ?? '—')}
              </TableCell>
              <TableCell>
                <StatusBadge status={row.status as DocumentStatus} />
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={cn(
                    'block text-sm',
                    waitedLong ? 'font-medium text-destructive' : 'text-muted-foreground',
                  )}
                  title={formatDhaka(when)}
                >
                  {timeAgo(when)}
                </span>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
