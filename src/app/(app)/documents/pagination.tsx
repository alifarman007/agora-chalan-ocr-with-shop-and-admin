'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui'

export function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number
  pageSize: number
  total: number
}) {
  const router = useRouter()
  const params = useSearchParams()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null

  function go(next: number) {
    const q = new URLSearchParams(params.toString())
    q.set('page', String(next))
    router.push('?' + q.toString())
  }

  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        {first}–{last} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => go(page - 1)}>
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <span className="px-2 text-xs text-muted-foreground">
          {page} of {pages}
        </span>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => go(page + 1)}>
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
