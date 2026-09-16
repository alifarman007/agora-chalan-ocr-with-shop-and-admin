'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'
import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  toast,
} from '@/components/ui'
import { listMemberships, setMemberships } from '@/server/actions/setup'

type Person = { userId: string; name: string; email: string }
type Candidate = { id: string; name: string; email: string }
type Kind = 'member' | 'approver'

export function ShopPeople({
  shopId,
  shopName,
  members,
  approvers,
  candidates,
}: {
  shopId: string
  shopName: string
  members: Person[]
  approvers: Person[]
  candidates: Candidate[]
}) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()

  /**
   * setMemberships replaces the whole set for one person and one kind, so we read
   * that person's current shops first and send the list back with this shop added
   * or taken out.
   */
  function change(kind: Kind, userId: string, mode: 'add' | 'remove') {
    startTransition(async () => {
      const current = await listMemberships({ userId })
      if (!current.ok) {
        toast.error(current.error)
        return
      }
      const rows = kind === 'approver' ? current.approvers : current.members
      const existing = rows.map((row) => row.shopId)
      const shopIds =
        mode === 'add'
          ? [...new Set([...existing, shopId])]
          : existing.filter((value) => value !== shopId)

      const result = await setMemberships({ userId, shopIds, kind })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        mode === 'add' ? `Added to ${shopName}.` : `Removed from ${shopName}.`,
      )
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader bordered>
        <CardTitle>People</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <PeopleGroup
          title="Can work in this shop"
          hint="These people can upload and edit documents for this shop."
          people={members}
          candidates={candidates}
          busy={busy}
          onAdd={(userId) => change('member', userId, 'add')}
          onRemove={(userId) => change('member', userId, 'remove')}
        />
        <PeopleGroup
          title="Can approve for this shop"
          hint="These people can approve or reject this shop's documents. Admins can already approve everywhere."
          people={approvers}
          candidates={candidates}
          busy={busy}
          onAdd={(userId) => change('approver', userId, 'add')}
          onRemove={(userId) => change('approver', userId, 'remove')}
        />
      </CardContent>
    </Card>
  )
}

function PeopleGroup({
  title,
  hint,
  people,
  candidates,
  busy,
  onAdd,
  onRemove,
}: {
  title: string
  hint: string
  people: Person[]
  candidates: Candidate[]
  busy: boolean
  onAdd: (userId: string) => void
  onRemove: (userId: string) => void
}) {
  const [choice, setChoice] = useState('')
  const taken = new Set(people.map((person) => person.userId))
  const options = candidates
    .filter((candidate) => !taken.has(candidate.id))
    .map((candidate) => ({ value: candidate.id, label: `${candidate.name} · ${candidate.email}` }))

  return (
    <section>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>

      {people.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Nobody yet.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {people.map((person) => (
            <li key={person.userId} className="flex items-center gap-3 px-3 py-2">
              <Avatar name={person.name} size="sm" />
              <span className="min-w-0 flex-1">
                <Link
                  href={`/setup/users/${person.userId}`}
                  className="block truncate text-sm font-medium hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {person.name}
                </Link>
                <span className="block truncate text-xs text-muted-foreground">
                  {person.email}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${person.name}`}
                disabled={busy}
                onClick={() => onRemove(person.userId)}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Select
          value={choice}
          onChange={(event) => setChoice(event.currentTarget.value)}
          options={options}
          placeholder={options.length === 0 ? 'Everybody is already added' : 'Choose a person…'}
          disabled={options.length === 0 || busy}
          containerClassName="flex-1"
          aria-label={`Add somebody who ${title.toLowerCase()}`}
        />
        <Button
          variant="outline"
          leftIcon={<Plus className="size-4" />}
          disabled={!choice || busy}
          onClick={() => {
            onAdd(choice)
            setChoice('')
          }}
        >
          Add
        </Button>
      </div>
    </section>
  )
}
