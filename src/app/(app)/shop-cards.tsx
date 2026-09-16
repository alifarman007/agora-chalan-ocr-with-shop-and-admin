import Link from 'next/link'
import { Store } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import type { ShopSummary } from '@/server/queries/documents'

export function ShopCards({ shops }: { shops: ShopSummary[] }) {
  if (shops.length === 0) {
    return (
      <EmptyState
        icon={<Store className="size-6" />}
        title="No documents yet"
        description="Once a branch uploads its first chalan, it will appear here with its most recent images."
      />
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {shops.map((shop) => (
        <div
          key={shop.shopId}
          className="flex flex-col rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/documents?shop=${shop.shopId}`}
                className="block truncate font-semibold hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                {shop.shopName}
              </Link>
              <p className="truncate text-xs text-muted-foreground">{shop.shopCode}</p>
            </div>
            <p className="shrink-0 text-2xl font-bold tabular-nums">{shop.total}</p>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
            {shop.pending > 0 && (
              <span className="rounded-sm bg-warning/20 px-1.5 py-0.5 font-medium text-warning-foreground">
                {shop.pending} waiting
              </span>
            )}
            {shop.approved > 0 && (
              <span className="rounded-sm bg-success/10 px-1.5 py-0.5 font-medium text-success">
                {shop.approved} approved
              </span>
            )}
            {shop.rejected > 0 && (
              <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive">
                {shop.rejected} rejected
              </span>
            )}
          </div>

          {shop.thumbs.length > 0 && (
            <div className="mt-4 grid grid-cols-4 gap-1.5">
              {shop.thumbs.map((t) => (
                <Link
                  key={t.id}
                  href={`/documents/${t.id}`}
                  title="Open this document"
                  className="aspect-3/4 overflow-hidden rounded-sm border border-border bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/files/${t.id}/thumb`}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition-transform hover:scale-105"
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
