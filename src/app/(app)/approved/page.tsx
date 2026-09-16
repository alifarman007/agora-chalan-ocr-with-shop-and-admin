import type { Metadata } from 'next'
import { requirePermission } from '@/lib/auth/session'
import { listDocuments } from '@/server/queries/documents'
import { PageHeader } from '@/components/layout/page-header'
import { DocumentTable } from '@/components/documents/document-table'
import { Pagination } from '../documents/pagination'

export const metadata: Metadata = { title: 'Approved' }

const PAGE_SIZE = 25

export default async function ApprovedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const actor = await requirePermission('document.view')
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? '1') || 1)

  const { rows, total } = await listDocuments(
    actor.readScope,
    { status: 'approved' },
    { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
  )
  const ordered = [...rows].sort(
    (a, b) => new Date(b.reviewedAt ?? 0).getTime() - new Date(a.reviewedAt ?? 0).getTime(),
  )

  return (
    <>
      <PageHeader
        title="Approved"
        description={total === 1 ? '1 approved document' : total + ' approved documents'}
      />
      <DocumentTable
        rows={ordered}
        variant="approved"
        emptyTitle="Nothing approved yet"
        emptyDescription="Approved documents are kept here as a record."
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  )
}
