import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ScrollText } from 'lucide-react'
import { getActor } from '@/lib/auth/session'
import { listAuditActions, listAuditLog } from '@/server/actions/admin'
import { PageHeader } from '@/components/layout/page-header'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/cn'
import { AuditFilters } from './audit-filters'
import { AuditTable, type AuditRowView } from './audit-table'

export const metadata: Metadata = { title: 'Audit log' }

const PAGE_SIZE = 50
const DATE = /^\d{4}-\d{2}-\d{2}$/

type SearchParams = Promise<{
  q?: string
  action?: string
  from?: string
  to?: string
  page?: string
}>

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await getActor()
  if (!actor) redirect('/login')

  if (!actor.permissions.has('audit.view')) {
    return (
      <EmptyState
        icon={<ScrollText className="size-6" aria-hidden="true" />}
        title="The audit log is not open to you"
        description="Ask an administrator if you think you should be able to see it."
      />
    )
  }

  const sp = await searchParams
  const search = (sp.q ?? '').trim()
  const action = (sp.action ?? '').trim()
  const from = DATE.test(sp.from ?? '') ? sp.from! : ''
  const to = DATE.test(sp.to ?? '') ? sp.to! : ''
  const page = Math.max(1, Number(sp.page) || 1)

  const [result, actionsResult] = await Promise.all([
    listAuditLog({
      search: search || undefined,
      action: action || undefined,
      from: from || undefined,
      to: to || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    listAuditActions(),
  ])

  if (!result.ok) {
    return (
      <EmptyState
        tone="destructive"
        title="The audit log could not be loaded"
        description={result.error}
      />
    )
  }

  const rows: AuditRowView[] = result.rows.map((row) => ({
    id: row.id,
    createdAt: new Date(row.createdAt).toISOString(),
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    details: row.details,
    actorName: row.actorName,
    actorEmail: row.actorEmail,
  }))

  const total = result.total
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const last = Math.min(page * PAGE_SIZE, total)

  function pageHref(next: number) {
    const q = new URLSearchParams()
    if (search) q.set('q', search)
    if (action) q.set('action', action)
    if (from) q.set('from', from)
    if (to) q.set('to', to)
    if (next > 1) q.set('page', String(next))
    const query = q.toString()
    return query ? `/audit?${query}` : '/audit'
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change to shops, users, roles and Master Control, with who did it and when."
      />

      <AuditFilters
        search={search}
        action={action}
        from={from}
        to={to}
        actions={actionsResult.ok ? actionsResult.actions : []}
      />

      <AuditTable rows={rows} />

      {total > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Showing {first}–{last} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page <= 1}
              tabIndex={page <= 1 ? -1 : undefined}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                page <= 1 && 'pointer-events-none opacity-50',
              )}
            >
              Previous
            </Link>
            <span className="text-sm text-muted-foreground">
              Page {page} of {lastPage}
            </span>
            <Link
              href={pageHref(page + 1)}
              aria-disabled={page >= lastPage}
              tabIndex={page >= lastPage ? -1 : undefined}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                page >= lastPage && 'pointer-events-none opacity-50',
              )}
            >
              Next
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
