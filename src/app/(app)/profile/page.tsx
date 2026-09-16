import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { TriangleAlert } from 'lucide-react'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { getActor } from '@/lib/auth/session'
import { ROLE_META } from '@/lib/permissions'
import { PageHeader } from '@/components/layout/page-header'
import { PasswordCard, ProfileForm } from './profile-forms'

export const metadata: Metadata = { title: 'Your profile' }

export default async function ProfilePage() {
  const actor = await getActor()
  if (!actor) redirect('/login')

  const row = await db.query.users.findFirst({
    where: eq(users.id, actor.id),
    columns: { phone: true },
  })

  const role = ROLE_META[actor.roleCode]

  return (
    <>
      <PageHeader
        title="Your profile"
        description="Your own details and password. Only an administrator can change your role or email."
      />

      {actor.mustChangePassword && (
        <div className="mb-4 flex items-start gap-3 rounded-[var(--radius)] border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <p className="text-amber-800 dark:text-amber-200">
            You are still using the password an administrator gave you. Please set your own below.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileForm
          name={actor.name}
          email={actor.email}
          phone={row?.phone ?? ''}
          roleName={role.name}
          roleDescription={role.description}
        />
        <PasswordCard />
      </div>
    </>
  )
}
