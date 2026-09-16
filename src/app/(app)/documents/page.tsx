import type { Metadata } from 'next'
import Link from 'next/link'
import { CloudUpload } from 'lucide-react'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { documentTypes, shops } from '@/db/schema'
import { requirePermission } from '@/lib/auth/session'
import { listDocuments } from '@/server/queries/documents'
import { PageHeader } from '@/components/layout/page-header'
import { DocumentTable } from '@/components/documents/document-table'
import { LinkButton } from '@/components/ui/link-button'
import { DocumentFilters } from './document-filters'
import { Pagination } from './pagination'
import type { DocumentStatus } from '@/db/schema'

export const metadata: Metadata = { title: 'Documents' }

const PAGE_SIZE = 25

type SearchParams = Promise<{
  shop?: string
  status?: string
  type?: string
  q?: string
  page?: string
}>

export default async function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePermission('document.view')
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? '1') || 1)

  const { rows, total } = await listDocuments(
    actor.readScope,
    {
      shopIds: sp.shop ? [sp.shop] : undefined,
      status: sp.status ? (sp.status as DocumentStatus) : undefined,
      documentTypeCode: sp.type,
      search: sp.q,
    },
    { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
  )

  const scope = actor.readScope
  const shopOptions =
    scope === 'all'
      ? await db.select().from(shops).orderBy(shops.name)
      : scope.length === 0
        ? []
        : await db.select().from(shops).where(inArray(shops.id, scope)).orderBy(shops.name)

  const typeOptions = await db
    .select()
    .from(documentTypes)
    .where(eq(documentTypes.isActive, true))
    .orderBy(documentTypes.sortOrder)

  return (
    <>
      <PageHeader
        title="Documents"
        description={total === 1 ? '1 document' : total + ' documents'}
        actions={
          actor.permissions.has('document.upload') ? (
            <LinkButton href="/documents/new">
              <CloudUpload className="size-4" />
              Upload
            </LinkButton>
          ) : undefined
        }
      />

      <div className="mb-4">
        <DocumentFilters
          shops={shopOptions.map((s) => ({ id: s.id, name: s.name }))}
          types={typeOptions.map((t) => ({ code: t.code, name: t.name }))}
        />
      </div>

      <DocumentTable
        rows={rows}
        variant="all"
        currentUserId={actor.id}
        emptyTitle="No documents yet"
        emptyDescription="When someone uploads a chalan or receipt, it will show up here."
      />

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  )
}
