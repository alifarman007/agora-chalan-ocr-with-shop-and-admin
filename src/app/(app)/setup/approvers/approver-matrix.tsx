'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ShieldCheck, Store } from 'lucide-react'
import { Button, Checkbox, EmptyState, toast } from '@/components/ui'
import { setMemberships } from '@/server/actions/setup'

type Shop = { id: string; code: string; name: string }
type Approver = { id: string; name: string; email: string; shopIds: string[] }

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',')
}

export function ApproverMatrix({
  shops,
  approvers,
}: {
  shops: Shop[]
  approvers: Approver[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const initial = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const approver of approvers) map[approver.id] = approver.shopIds
    return map
  }, [approvers])

  const [draft, setDraft] = useState<Record<string, string[]>>(initial)

  const dirtyIds = approvers
    .filter((approver) => !sameSet(draft[approver.id] ?? [], initial[approver.id] ?? []))
    .map((approver) => approver.id)

  function toggle(userId: string, shopId: string, on: boolean) {
    setDraft((current) => {
      const existing = current[userId] ?? []
      return {
        ...current,
        [userId]: on
          ? [...new Set([...existing, shopId])]
          : existing.filter((id) => id !== shopId),
      }
    })
  }

  function save() {
    startTransition(async () => {
      for (const userId of dirtyIds) {
        const result = await setMemberships({
          userId,
          shopIds: draft[userId] ?? [],
          kind: 'approver',
        })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
      }
      toast.success(
        dirtyIds.length === 1 ? 'Saved 1 approver.' : `Saved ${dirtyIds.length} approvers.`,
      )
      router.refresh()
    })
  }

  if (shops.length === 0) {
    return (
      <EmptyState
        icon={<Store className="size-6" />}
        title="No shops yet"
        description="Add a shop first. Then you can say who approves for it."
        action={
          <Link href="/setup/shops" className="text-sm font-medium text-blue-600 hover:underline">
            Go to shops
          </Link>
        }
      />
    )
  }

  if (approvers.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck className="size-6" />}
        title="Nobody has the Approver role"
        description="Give somebody the Approver role on the Users page. They will then appear here, and you can tick the shops they approve for."
        action={
          <Link href="/setup/users" className="text-sm font-medium text-blue-600 hover:underline">
            Go to users
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tick a box to let that person approve that shop&apos;s documents. Scroll sideways to
        see every shop.
      </p>

      <div className="relative w-full overflow-x-auto overscroll-x-contain rounded-[var(--radius)] border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 h-12 min-w-48 border-b border-border bg-muted px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Approver
              </th>
              {shops.map((shop) => (
                <th
                  key={shop.id}
                  scope="col"
                  className="h-12 min-w-28 border-b border-l border-border bg-muted px-3 text-center text-xs font-semibold text-muted-foreground"
                >
                  <span className="block truncate" title={`${shop.name} (${shop.code})`}>
                    {shop.name}
                  </span>
                  <span className="block truncate font-mono text-[10px] font-normal opacity-70">
                    {shop.code}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {approvers.map((approver) => {
              const chosen = draft[approver.id] ?? []
              const isDirty = dirtyIds.includes(approver.id)
              return (
                <tr key={approver.id} className="border-b border-border last:border-b-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 min-w-48 bg-card px-3 py-2.5 text-left font-normal"
                  >
                    <Link
                      href={`/setup/users/${approver.id}`}
                      className="block truncate text-sm font-medium hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {approver.name}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">
                      {approver.email}
                      {isDirty && <span className="ml-1 text-warning-foreground">· unsaved</span>}
                    </span>
                  </th>
                  {shops.map((shop) => (
                    <td
                      key={shop.id}
                      className="border-l border-border px-3 py-2.5 text-center"
                    >
                      <Checkbox
                        checked={chosen.includes(shop.id)}
                        onChange={(event) =>
                          toggle(approver.id, shop.id, event.currentTarget.checked)
                        }
                        disabled={pending}
                        aria-label={`${approver.name} can approve for ${shop.name}`}
                        containerClassName="justify-center"
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {dirtyIds.length > 0 && (
          <span className="mr-auto text-sm text-muted-foreground">
            {dirtyIds.length === 1
              ? '1 person has unsaved changes.'
              : `${dirtyIds.length} people have unsaved changes.`}
          </span>
        )}
        <Button
          variant="ghost"
          onClick={() => setDraft(initial)}
          disabled={dirtyIds.length === 0 || pending}
        >
          Undo
        </Button>
        <Button
          onClick={save}
          loading={pending}
          loadingText="Saving…"
          disabled={dirtyIds.length === 0}
        >
          Save changes
        </Button>
      </div>
    </div>
  )
}
