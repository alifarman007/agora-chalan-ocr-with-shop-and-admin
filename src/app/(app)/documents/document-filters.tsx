'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { Button, Input, Select } from '@/components/ui'

const STATUSES = [
  { value: '', label: 'Any status' },
  { value: 'draft', label: 'Needs review' },
  { value: 'pending_approval', label: 'Waiting for approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Sent back' },
  { value: 'processing', label: 'Being read' },
  { value: 'failed', label: 'Failed' },
]

export function DocumentFilters({
  shops,
  types,
}: {
  shops: { id: string; name: string }[]
  types: { code: string; name: string }[]
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')

  function apply(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    router.push('?' + next.toString())
  }

  const hasFilters = ['shop', 'status', 'type', 'q'].some((k) => params.get(k))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          apply('q', q.trim())
        }}
        className="flex min-w-48 flex-1 items-center gap-2 sm:max-w-xs"
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search chalan number or text"
          leftIcon={<Search className="size-4" />}
          className="bangla-text"
        />
      </form>

      {shops.length > 1 && (
        <Select
          aria-label="Shop"
          value={params.get('shop') ?? ''}
          onChange={(e) => apply('shop', e.target.value)}
          className="w-40"
          options={[{ value: '', label: 'All shops' }, ...shops.map((s) => ({ value: s.id, label: s.name }))]}
        />
      )}

      <Select
        aria-label="Status"
        value={params.get('status') ?? ''}
        onChange={(e) => apply('status', e.target.value)}
        className="w-48"
        options={STATUSES}
      />

      {types.length > 1 && (
        <Select
          aria-label="Kind"
          value={params.get('type') ?? ''}
          onChange={(e) => apply('type', e.target.value)}
          className="w-40"
          options={[{ value: '', label: 'Any kind' }, ...types.map((t) => ({ value: t.code, label: t.name }))]}
        />
      )}

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ('')
            router.push('?')
          }}
        >
          <X className="size-4" />
          Clear
        </Button>
      )}
    </div>
  )
}
