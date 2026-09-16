import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { documents, shops, users } from '@/db/schema'
import { can, requirePermission } from '@/lib/auth/session'
import { formatDhaka, timeAgo } from '@/lib/format'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle, StatusBadge } from '@/components/ui'
import type { DocumentStatus } from '@/components/ui/status-badge'
import { listMemberships } from '@/server/actions/setup'
import { ShopDetailsForm } from './shop-details-form'
import { ShopPeople } from './shop-people'

export const metadata: Metadata = { title: 'Shop' }

export default async function ShopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const actor = await requirePermission('shop.manage')

  const shop = await db.query.shops.findFirst({ where: eq(shops.id, id) })
  if (!shop) notFound()

  const mayManagePeople = can(actor, 'membership.manage')

  const [people, recent, everyone] = await Promise.all([
    mayManagePeople
      ? listMemberships({ shopId: id })
      : Promise.resolve({ ok: true as const, members: [], approvers: [] }),
    db
      .select({
        id: documents.id,
        status: documents.status,
        originalFilename: documents.originalFilename,
        thumbnailKey: documents.thumbnailKey,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.shopId, id))
      .orderBy(desc(documents.createdAt))
      .limit(10),
    mayManagePeople
      ? db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            roleCode: users.roleCode,
          })
          .from(users)
          .where(and(eq(users.isActive, true)))
          .orderBy(asc(users.name))
      : Promise.resolve([]),
  ])

  return (
    <>
      <PageHeader
        title={shop.name}
        description={`Shop code ${shop.code}. The code cannot be changed, because every document is filed under it.`}
        actions={
          <Link
            href="/setup/shops"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Back to all shops
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ShopDetailsForm
          shop={{
            id: shop.id,
            code: shop.code,
            name: shop.name,
            address: shop.address,
            phone: shop.phone,
            isActive: shop.isActive,
          }}
        />

        {mayManagePeople && people.ok && (
          <ShopPeople
            shopId={shop.id}
            shopName={shop.name}
            members={people.members.map((row) => ({
              userId: row.userId,
              name: row.userName,
              email: row.userEmail,
            }))}
            approvers={people.approvers.map((row) => ({
              userId: row.userId,
              name: row.userName,
              email: row.userEmail,
            }))}
            candidates={everyone.map((user) => ({
              id: user.id,
              name: user.name,
              email: user.email,
            }))}
          />
        )}
      </div>

      <Card className="mt-6">
        <CardHeader bordered>
          <CardTitle>Latest documents</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing uploaded for this shop yet.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {recent.map((doc) => (
                <li key={doc.id}>
                  <Link
                    href={`/documents/${doc.id}`}
                    className="block rounded-lg border border-border p-2 transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {doc.thumbnailKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/files/${doc.id}/thumb`}
                        alt=""
                        className="aspect-4/3 w-full rounded-sm border border-border object-cover"
                      />
                    ) : (
                      <span className="flex aspect-4/3 w-full items-center justify-center rounded-sm border border-border bg-muted text-[10px] text-muted-foreground">
                        No preview
                      </span>
                    )}
                    <span className="mt-2 block truncate text-xs font-medium">
                      {doc.originalFilename}
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-1">
                      <StatusBadge status={doc.status as DocumentStatus} size="sm" />
                      <span
                        className="shrink-0 text-[10px] text-muted-foreground"
                        title={formatDhaka(doc.createdAt)}
                      >
                        {timeAgo(doc.createdAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}
