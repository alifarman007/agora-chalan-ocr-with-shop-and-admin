import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  CircleCheck,
  ClipboardCheck,
  Coins,
  FileText,
  TriangleAlert,
} from 'lucide-react'
import { getActor } from '@/lib/auth/session'
import {
  costSummary,
  countsByStatus,
  dailyTrend,
  listDocuments,
  perShopSummary,
  withThumbnails,
} from '@/server/queries/documents'
import { getSettings } from '@/server/settings'
import { dhakaDayRange, daysAgoInDhaka, formatBDT, formatUSD, todayInDhaka } from '@/lib/format'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { DashboardFilters } from './dashboard-filters'
import { KpiCard } from './kpi-card'
import { TrendChart } from './trend-chart'
import { ShopCards } from './shop-cards'
import { PendingPreview } from './pending-preview'

export const metadata: Metadata = { title: 'Dashboard' }

type SearchParams = Promise<{ from?: string; to?: string; shop?: string | string[] }>

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await getActor()
  if (!actor) redirect('/login')
  if (!actor.permissions.has('dashboard.view')) {
    return (
      <EmptyState
        title="Nothing to show yet"
        description="Your account does not have access to the dashboard. Ask an administrator if you think that is wrong."
      />
    )
  }

  const sp = await searchParams
  // Default range: the last 30 days, counted in Dhaka time so "today" means today
  // in Bangladesh rather than wherever the server happens to be.
  const from = sp.from ?? daysAgoInDhaka(29)
  const to = sp.to ?? todayInDhaka()
  const shopIds = sp.shop ? (Array.isArray(sp.shop) ? sp.shop : [sp.shop]) : undefined
  const range = dhakaDayRange(from, to)
  const filters = { from: range.start, to: range.end, shopIds }

  const scope = actor.readScope
  const [counts, trend, shops, pending, settings, cost] = await Promise.all([
    countsByStatus(scope, filters),
    dailyTrend(scope, filters),
    perShopSummary(scope, filters),
    listDocuments(scope, { ...filters, status: 'pending_approval' }, { limit: 5, offset: 0 }),
    getSettings(),
    actor.permissions.has('shop.view_all')
      ? costSummary(scope, filters)
      : Promise.resolve(null),
  ])

  const pendingRows = await withThumbnails(pending.rows)

  const approved = counts.byStatus.approved ?? 0
  const pendingCount = counts.byStatus.pending_approval ?? 0
  const needsAttention = (counts.byStatus.rejected ?? 0) + (counts.byStatus.failed ?? 0)

  const rate = settings['cost.usd_to_bdt']
  const allShops =
    scope === 'all'
      ? shops.map((s) => ({ id: s.shopId, name: s.shopName, code: s.shopCode }))
      : shops.map((s) => ({ id: s.shopId, name: s.shopName, code: s.shopCode }))

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Documents from ${from} to ${to}, shown in Bangladesh time.`}
        actions={<DashboardFilters from={from} to={to} shopIds={shopIds} shops={allShops} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total documents"
          value={counts.total}
          icon={<FileText className="size-5" />}
          tone="brand"
          href="/documents"
        />
        <KpiCard
          label="Waiting for approval"
          value={pendingCount}
          icon={<ClipboardCheck className="size-5" />}
          tone={pendingCount > 0 ? 'warning' : 'neutral'}
          href="/approvals"
        />
        <KpiCard
          label="Approved"
          value={approved}
          icon={<CircleCheck className="size-5" />}
          tone="success"
          href="/approved"
        />
        <KpiCard
          label="Needs attention"
          value={needsAttention}
          hint="Rejected or failed to read"
          icon={<TriangleAlert className="size-5" />}
          tone={needsAttention > 0 ? 'destructive' : 'neutral'}
          href="/documents?status=rejected"
        />
      </div>

      {cost && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="Reading cost"
            value={formatUSD(cost.costUsd, 2)}
            hint={`about ${formatBDT(cost.costUsd * rate)}`}
            icon={<Coins className="size-5" />}
            tone="neutral"
          />
          <KpiCard
            label="Documents read"
            value={cost.processed}
            hint={`${cost.failed} failed`}
            icon={<FileText className="size-5" />}
            tone="neutral"
          />
          <KpiCard
            label="Success rate"
            value={
              cost.processed + cost.failed === 0
                ? '—'
                : Math.round((cost.processed / (cost.processed + cost.failed)) * 100) + '%'
            }
            icon={<CircleCheck className="size-5" />}
            tone="neutral"
          />
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardContent className="pt-6">
            <h2 className="mb-1 text-sm font-semibold">Documents per day</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Counted by the day the document was uploaded, in Bangladesh time.
            </p>
            <TrendChart data={trend} from={from} to={to} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Oldest waiting</h2>
              <Link href="/approvals" className="text-xs font-medium text-primary hover:underline">
                See all
              </Link>
            </div>
            <PendingPreview rows={pendingRows} currentUserId={actor.id} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="mb-1 text-sm font-semibold">By shop</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          How many documents each branch sent, with their most recent uploads.
        </p>
        <ShopCards shops={shops} />
      </div>
    </>
  )
}
