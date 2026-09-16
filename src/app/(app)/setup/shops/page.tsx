import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { requirePermission } from '@/lib/auth/session'
import { listShops } from '@/server/actions/setup'
import { ShopsClient } from './shops-client'

export const metadata: Metadata = { title: 'Shops' }

export default async function ShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ inactive?: string }>
}) {
  const params = await searchParams
  // The page checks too, even though every action re-checks for itself.
  await requirePermission('shop.manage')

  const includeInactive = params.inactive === '1'
  const result = await listShops({ includeInactive })

  return (
    <>
      <PageHeader
        title="Shops"
        description="Every branch that can upload documents. A shop is never deleted — switch it off instead, so its old documents still point at a real shop."
      />
      {result.ok ? (
        <ShopsClient shops={result.shops} includeInactive={includeInactive} />
      ) : (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {result.error}
        </p>
      )}
    </>
  )
}
