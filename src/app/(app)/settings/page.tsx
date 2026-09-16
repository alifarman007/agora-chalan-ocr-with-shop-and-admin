import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { getActor } from '@/lib/auth/session'
import { getSettings } from '@/server/settings'
import { LinkButton } from '@/components/ui/link-button'
import { PageHeader } from '@/components/layout/page-header'
import { } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { SettingsForm } from './settings-form'

export const metadata: Metadata = { title: 'Master Control' }

export default async function SettingsPage() {
  const actor = await getActor()
  if (!actor) redirect('/login')

  // The page checks too, but this is never the only check: updateSettings
  // re-checks on the server for every save.
  if (!actor.permissions.has('settings.manage')) {
    return (
      <EmptyState
        icon={<SlidersHorizontal className="size-6" aria-hidden="true" />}
        title="Master Control is not open to you"
        description="Only a Super Admin can change these settings. Ask an administrator if you think that is wrong."
      />
    )
  }

  const settings = await getSettings()

  return (
    <>
      <PageHeader
        title="Master Control"
        description="The rules the whole system runs on. A change takes effect on the next page load."
        actions={
          actor.permissions.has('role.manage') ? (
            <LinkButton href="/settings/roles"  variant="outline">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Roles and permissions
            </LinkButton>
          ) : null
        }
      />
      <SettingsForm settings={settings} />
    </>
  )
}
