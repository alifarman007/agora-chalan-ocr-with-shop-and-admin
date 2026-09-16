import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ScanText } from 'lucide-react'
import { getActor } from '@/lib/auth/session'
import { getSettings } from '@/server/settings'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in' }

// Reads the session and the company name, so there is nothing to prerender.
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const actor = await getActor()
  if (actor) redirect('/')
  const settings = await getSettings()

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel — hidden on small screens so the form gets the room. */}
      <aside className="relative hidden flex-col justify-between bg-slate-900 p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-blue-600">
            <ScanText className="size-6" />
          </span>
          <div>
            <p className="text-lg font-bold tracking-tight">{settings['company.name']}</p>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Chalan Dashboard
            </p>
          </div>
        </div>

        <div className="max-w-md">
          <h2 className="text-3xl font-bold leading-tight">
            Read a chalan in seconds. Approve it with confidence.
          </h2>
          <p className="mt-4 text-slate-300">
            Upload a delivery chalan or receipt, let the reader pull out the details, correct
            anything it got wrong, and send it for approval. Works with Bangla and English.
          </p>
        </div>

        <p className="text-xs text-slate-500">
          Every action is recorded: who did it, when, and what they said.
        </p>
      </aside>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-lg bg-brand text-brand-foreground">
              <ScanText className="size-6" />
            </span>
            <div>
              <p className="text-lg font-bold tracking-tight">{settings['company.name']}</p>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Chalan Dashboard
              </p>
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the email and password your administrator gave you.
          </p>

          <LoginForm />

          <p className="mt-8 text-xs text-muted-foreground">
            No account? Accounts are created by an administrator, not by signing up.
          </p>
        </div>
      </div>
    </main>
  )
}
