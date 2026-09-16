import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { getActor } from '@/lib/auth/session'
import { getRolePermissions } from '@/server/actions/admin'
import { PageHeader } from '@/components/layout/page-header'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { RolesGrid } from './roles-grid'

export const metadata: Metadata = { title: 'Roles and permissions' }

export default async function RolesPage() {
  const actor = await getActor()
  if (!actor) redirect('/login')

  if (!actor.permissions.has('role.manage')) {
    return (
      <EmptyState
        icon={<ShieldCheck className="size-6" aria-hidden="true" />}
        title="The permission grid is not open to you"
        description="Only a Super Admin can change which role has which permission."
      />
    )
  }

  const result = await getRolePermissions()
  if (!result.ok) {
    return (
      <EmptyState
        tone="destructive"
        title="The permission grid could not be loaded"
        description={result.error}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Roles and permissions"
        description="Tick a box to give a role a permission. Changes apply the next time that user loads a page."
        actions={
          actor.permissions.has('settings.manage') ? (
            <Link href="/settings" className={buttonVariants({ variant: 'outline' })}>
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Master Control
            </Link>
          ) : null
        }
      />
      <RolesGrid grid={result.grid} />
    </>
  )
}
