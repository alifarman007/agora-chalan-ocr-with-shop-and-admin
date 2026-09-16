import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { requirePermission } from '@/lib/auth/session'
import { isRoleCode } from '@/lib/permissions'
import { assignableRoles, listUsers } from '@/server/actions/setup'
import { UsersClient } from './users-client'

export const metadata: Metadata = { title: 'Users' }

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; inactive?: string }>
}) {
  const params = await searchParams
  await requirePermission('user.manage')

  const search = params.q?.trim() ?? ''
  const roleCode = params.role && isRoleCode(params.role) ? params.role : undefined
  const includeInactive = params.inactive === '1'

  const [result, canAssign] = await Promise.all([
    listUsers({ search: search || undefined, roleCode, includeInactive }),
    assignableRoles(),
  ])

  return (
    <>
      <PageHeader
        title="Users"
        description="Everybody who can sign in. New people get a temporary password and must change it the first time they sign in."
      />
      {result.ok ? (
        <UsersClient
          users={result.users}
          search={search}
          roleCode={roleCode ?? ''}
          includeInactive={includeInactive}
          assignableRoles={canAssign}
        />
      ) : (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {result.error}
        </p>
      )}
    </>
  )
}
