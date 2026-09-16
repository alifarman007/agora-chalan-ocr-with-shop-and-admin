import { redirect } from 'next/navigation'
import { getActor } from '@/lib/auth/session'
import { getSettings } from '@/server/settings'
import { ROLE_META } from '@/lib/permissions'
import { MobileNav, Sidebar } from '@/components/layout/nav'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { UserMenu } from '@/components/layout/user-menu'

/**
 * The authenticated shell.
 *
 * This layout checks the session, but it is NOT the only check — every server action
 * and route handler re-checks for itself, because Server Actions POST to the page
 * route and can bypass a layout entirely.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor()
  if (!actor) redirect('/login')

  const settings = await getSettings()
  const permissions = [...actor.permissions]
  const companyName = settings['company.name']

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar permissions={permissions} companyName={companyName} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
          <MobileNav permissions={permissions} companyName={companyName} />
          <div className="flex-1" />
          <ThemeToggle />
          <UserMenu
            name={actor.name}
            email={actor.email}
            roleName={ROLE_META[actor.roleCode].name}
          />
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
