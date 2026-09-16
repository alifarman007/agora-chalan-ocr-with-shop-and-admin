'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { actionLabel } from './details'

export function AuditFilters({
  search,
  action,
  from,
  to,
  actions,
}: {
  search: string
  action: string
  from: string
  to: string
  actions: string[]
}) {
  const router = useRouter()
  const params = useSearchParams()

  function apply(next: Record<string, string>) {
    const q = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value === '') q.delete(key)
      else q.set(key, value)
    }
    // Any filter change starts again at page one.
    q.delete('page')
    router.push(`/audit?${q.toString()}`)
  }

  const hasFilters = Boolean(search || action || from || to)

  return (
    <form
      className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(e) => {
        e.preventDefault()
        const value = new FormData(e.currentTarget).get('q')
        apply({ q: typeof value === 'string' ? value.trim() : '' })
      }}
    >
      <div className="min-w-0 flex-1 sm:max-w-xs">
        <label htmlFor="audit-search" className="mb-1 block text-xs font-medium text-muted-foreground">
          Search
        </label>
        <Input
          id="audit-search"
          name="q"
          /* The key resets the box whenever the URL's search changes. */
          key={search}
          defaultValue={search}
          placeholder="Name, action or target"
          leftIcon={<Search className="size-4" aria-hidden="true" />}
        />
      </div>

      <div className="sm:w-52">
        <label htmlFor="audit-action" className="mb-1 block text-xs font-medium text-muted-foreground">
          Action
        </label>
        <Select
          id="audit-action"
          value={action}
          onChange={(e) => apply({ action: e.target.value })}
          options={[
            { value: '', label: 'Every action' },
            ...actions.map((a) => ({ value: a, label: actionLabel(a) })),
          ]}
        />
      </div>

      <div className="sm:w-40">
        <label htmlFor="audit-from" className="mb-1 block text-xs font-medium text-muted-foreground">
          From
        </label>
        <Input
          id="audit-from"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => apply({ from: e.target.value })}
        />
      </div>

      <div className="sm:w-40">
        <label htmlFor="audit-to" className="mb-1 block text-xs font-medium text-muted-foreground">
          To
        </label>
        <Input
          id="audit-to"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => apply({ to: e.target.value })}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            leftIcon={<X className="size-4" aria-hidden="true" />}
            onClick={() => router.push('/audit')}
          >
            Clear
          </Button>
        )}
      </div>
    </form>
  )
}
