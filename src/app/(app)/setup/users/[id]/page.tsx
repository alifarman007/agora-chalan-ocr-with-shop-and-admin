import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { can, requirePermission } from '@/lib/auth/session'
import { ROLE_META, type RoleCode } from '@/lib/permissions'
import { formatDhaka } from '@/lib/format'
import { PageHeader } from '@/components/layout/page-header'
import { Avatar } from '@/components/ui'
import { assignableRoles, listMemberships, listShopOptions } from '@/server/actions/setup'
import { RoleBadge } from '../role-badge'
import { UserDetail } from './user-detail'

export const metadata: Metadata = { title: 'User' }

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const actor = await requirePermission('user.manage')

  const user = await db.query.users.findFirst({ where: eq(users.id, id) })
  if (!user) notFound()

  const mayManageMemberships = can(actor, 'membership.manage')

  const [roles, shopOptions, memberships] = await Promise.all([
    assignableRoles(),
    mayManageMemberships
      ? listShopOptions()
      : Promise.resolve({ ok: true as const, shops: [] }),
    mayManageMemberships
      ? listMemberships({ userId: id })
      : Promise.resolve({ ok: true as const, members: [], approvers: [] }),
  ])

  const roleCode = user.roleCode as RoleCode

  return (
    <>
      <PageHeader
        title={user.name}
        description={`${user.email} · joined ${formatDhaka(user.createdAt, 'date')}`}
        actions={
          <Link
            href="/setup/users"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Back to all users
          </Link>
        }
      />

      <div className="mb-6 flex items-center gap-3">
        <Avatar name={user.name} size="lg" />
        <RoleBadge roleCode={roleCode} />
        <span className="text-sm text-muted-foreground">{ROLE_META[roleCode].description}</span>
      </div>

      <UserDetail
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          roleCode,
          isActive: user.isActive,
          mustChangePassword: user.mustChangePassword,
        }}
        isSelf={actor.id === user.id}
        assignableRoles={roles}
        canManageMemberships={mayManageMemberships}
        shops={shopOptions.ok ? shopOptions.shops : []}
        memberShopIds={memberships.ok ? memberships.members.map((row) => row.shopId) : []}
        approverShopIds={memberships.ok ? memberships.approvers.map((row) => row.shopId) : []}
      />
    </>
  )
}
