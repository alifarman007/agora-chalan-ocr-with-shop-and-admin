import type { Metadata } from 'next'
import { and, asc, eq, notInArray } from 'drizzle-orm'
import { db } from '@/db'
import { shopMemberships, shops, users } from '@/db/schema'
import { requirePermission } from '@/lib/auth/session'
import type { RoleCode } from '@/lib/permissions'
import { PageHeader } from '@/components/layout/page-header'
import { ApproverMatrix } from './approver-matrix'

export const metadata: Metadata = { title: 'Approvers' }

export default async function ApproversPage() {
  await requirePermission('membership.manage')

  const [activeShops, people, links] = await Promise.all([
    db
      .select({ id: shops.id, code: shops.code, name: shops.name })
      .from(shops)
      .where(eq(shops.isActive, true))
      .orderBy(asc(shops.name)),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        roleCode: users.roleCode,
      })
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          // Admins approve everywhere through a permission, not through a row here.
          notInArray(users.roleCode, ['super_admin', 'admin']),
        ),
      )
      .orderBy(asc(users.name)),
    db
      .select({ userId: shopMemberships.userId, shopId: shopMemberships.shopId })
      .from(shopMemberships)
      .where(eq(shopMemberships.kind, 'approver')),
  ])

  const byUser = new Map<string, string[]>()
  for (const link of links) {
    const list = byUser.get(link.userId) ?? []
    list.push(link.shopId)
    byUser.set(link.userId, list)
  }

  // Anybody whose role is Approver, plus anybody already approving somewhere.
  const rows = people
    .filter((person) => person.roleCode === 'approver' || byUser.has(person.id))
    .map((person) => ({
      id: person.id,
      name: person.name,
      email: person.email,
      roleCode: person.roleCode as RoleCode,
      shopIds: byUser.get(person.id) ?? [],
    }))

  return (
    <>
      <PageHeader
        title="Approvers"
        description="Who can approve for which shop. Admins can approve everything, so they are not listed here."
      />
      <ApproverMatrix shops={activeShops} approvers={rows} />
    </>
  )
}
