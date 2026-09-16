import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'

type Row = {
  id: string
  originalFilename: string
  chalanNumber: string | null
  shopName: string
  submittedAt: Date | null
  submittedByName: string | null
  submittedByUserId: string | null
  thumbUrl: string | null
  hoursWaiting: number | null
}

export function PendingPreview({
  rows,
  currentUserId,
}: {
  rows: Row[]
  currentUserId: string
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardCheck className="size-6" />}
        title="Nothing waiting"
        description="Every submitted document has been reviewed."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-1">
      {rows.map((row) => {
        // hoursWaiting comes from SQL, so nothing impure runs while rendering.
        const waitedLong = Number(row.hoursWaiting ?? 0) > 48
        const isOwn = row.submittedByUserId === currentUserId
        return (
          <li key={row.id}>
            <Link
              href={`/documents/${row.id}`}
              className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              {row.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.thumbUrl}
                  alt=""
                  className="size-10 shrink-0 rounded-sm border border-border object-cover"
                />
              ) : (
                <span className="size-10 shrink-0 rounded-sm border border-border bg-muted" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium bangla-text">
                  {row.chalanNumber || row.originalFilename}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {row.shopName} · {row.submittedByName ?? 'unknown'}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span
                  className={cn(
                    'block text-xs',
                    waitedLong ? 'font-medium text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {timeAgo(row.submittedAt)}
                </span>
                {isOwn && (
                  <span className="mt-0.5 block text-[10px] font-medium text-warning-foreground">
                    yours
                  </span>
                )}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
