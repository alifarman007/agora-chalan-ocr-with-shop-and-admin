'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

const PRESETS = [
  { label: 'Last 7 days', days: 6 },
  { label: 'Last 30 days', days: 29 },
  { label: 'Last 90 days', days: 89 },
]

function dhakaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date())
}
function dhakaDaysAgo(days: number) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(
    new Date(Date.now() - days * 86400000),
  )
}

export function DashboardFilters({
  from,
  to,
  shopIds,
  shops,
}: {
  from: string
  to: string
  shopIds?: string[]
  shops: { id: string; name: string; code: string }[]
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [localFrom, setLocalFrom] = useState(from)
  const [localTo, setLocalTo] = useState(to)

  function apply(next: { from?: string; to?: string; shop?: string }) {
    const q = new URLSearchParams(params.toString())
    if (next.from) q.set('from', next.from)
    if (next.to) q.set('to', next.to)
    if (next.shop !== undefined) {
      if (next.shop === '') q.delete('shop')
      else q.set('shop', next.shop)
    }
    router.push('?' + q.toString())
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {shops.length > 1 && (
        <Select
          aria-label="Filter by shop"
          value={shopIds?.[0] ?? ''}
          onChange={(e) => apply({ shop: e.target.value })}
          className="w-44"
          options={[
            { value: '', label: 'All shops' },
            ...shops.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      )}

      <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
        {PRESETS.map((p) => {
          const pFrom = dhakaDaysAgo(p.days)
          const pTo = dhakaToday()
          const active = from === pFrom && to === pTo
          return (
            <Button
              key={p.label}
              size="sm"
              variant={active ? 'secondary' : 'ghost'}
              onClick={() => {
                setLocalFrom(pFrom)
                setLocalTo(pTo)
                apply({ from: pFrom, to: pTo })
              }}
            >
              {p.label}
            </Button>
          )
        })}
      </div>

      <div className="flex items-center gap-1">
        <input
          type="date"
          aria-label="From date"
          value={localFrom}
          max={localTo}
          onChange={(e) => setLocalFrom(e.target.value)}
          onBlur={() => localFrom !== from && apply({ from: localFrom })}
          className="h-9 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <input
          type="date"
          aria-label="To date"
          value={localTo}
          min={localFrom}
          max={dhakaToday()}
          onChange={(e) => setLocalTo(e.target.value)}
          onBlur={() => localTo !== to && apply({ to: localTo })}
          className="h-9 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </div>
  )
}
