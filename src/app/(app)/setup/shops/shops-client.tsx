'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus, Store } from 'lucide-react'
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FieldError,
  FieldHint,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@/components/ui'
import { formatDhaka, formatNumber } from '@/lib/format'
import { createShop, type ShopListRow } from '@/server/actions/setup'

export function ShopsClient({
  shops,
  includeInactive,
}: {
  shops: ShopListRow[]
  includeInactive: boolean
}) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)

  function toggleInactive(next: boolean) {
    router.push(next ? '/setup/shops?inactive=1' : '/setup/shops')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Checkbox
          checked={includeInactive}
          onChange={(event) => toggleInactive(event.currentTarget.checked)}
          label="Show shops that are switched off"
        />
        <Button leftIcon={<Plus className="size-4" />} onClick={() => setAddOpen(true)}>
          Add shop
        </Button>
      </div>

      {shops.length === 0 ? (
        <EmptyState
          icon={<Store className="size-6" />}
          title="No shops yet"
          description="Add your first branch. After that, staff can be linked to it and start uploading chalans."
          action={<Button onClick={() => setAddOpen(true)}>Add shop</Button>}
          surface="card"
        />
      ) : (
        <>
          {/* Phones: one card per shop. */}
          <ul className="grid gap-3 md:hidden">
            {shops.map((shop) => (
              <li key={shop.id}>
                <Link
                  href={`/setup/shops/${shop.id}`}
                  className="block rounded-xl border border-border bg-card p-4 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{shop.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{shop.code}</p>
                    </div>
                    <ActiveBadge isActive={shop.isActive} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <dt className="sr-only">Phone</dt>
                      <dd>{shop.phone ?? 'No phone'}</dd>
                    </div>
                    <div className="text-right">
                      <dt className="sr-only">Documents</dt>
                      <dd>{formatNumber(shop.documentCount)} documents</dd>
                    </div>
                  </dl>
                </Link>
              </li>
            ))}
          </ul>

          {/* Tablet and up: the full table. */}
          <div className="hidden md:block">
            <Table zebra containerClassName="rounded-xl border border-border">
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead numeric>Documents</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shops.length === 0 ? (
                  <TableRow>
                    <TableEmpty colSpan={6}>No shops match this filter.</TableEmpty>
                  </TableRow>
                ) : (
                  shops.map((shop) => (
                    <TableRow
                      key={shop.id}
                      interactive
                      onClick={() => router.push(`/setup/shops/${shop.id}`)}
                    >
                      <TableCell className="font-mono text-xs">{shop.code}</TableCell>
                      <TableCell>
                        <Link
                          href={`/setup/shops/${shop.id}`}
                          className="font-medium hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {shop.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {shop.phone ?? '—'}
                      </TableCell>
                      <TableCell>
                        <ActiveBadge isActive={shop.isActive} />
                      </TableCell>
                      <TableCell numeric>{formatNumber(shop.documentCount)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDhaka(shop.createdAt, 'date')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <AddShopDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge variant={isActive ? 'success' : 'secondary'} dot>
      {isActive ? 'On' : 'Off'}
    </Badge>
  )
}

function AddShopDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')

  function reset() {
    setCode('')
    setName('')
    setAddress('')
    setPhone('')
    setError(null)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createShop({ code, name, address, phone })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success('Shop added.')
      reset()
      onOpenChange(false)
      router.push(`/setup/shops/${result.shopId}`)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add a shop</DialogTitle>
          <DialogDescription>
            The code is fixed once the shop is saved, because documents are filed under it.
          </DialogDescription>
        </DialogHeader>

        <DialogContent className="space-y-4">
          <div>
            <Label htmlFor="shop-code" required>
              Shop code
            </Label>
            <Input
              id="shop-code"
              value={code}
              onChange={(event) => setCode(event.currentTarget.value.toUpperCase())}
              placeholder="DHK-GUL-01"
              autoComplete="off"
              maxLength={20}
              required
              className="font-mono"
            />
            <FieldHint>
              2 to 20 characters. Capital letters, numbers and dashes only. It cannot be
              changed later.
            </FieldHint>
          </div>

          <div>
            <Label htmlFor="shop-name" required>
              Name
            </Label>
            <Input
              id="shop-name"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              placeholder="Gulshan 1"
              maxLength={120}
              required
            />
          </div>

          <div>
            <Label htmlFor="shop-address">Address</Label>
            <Input
              id="shop-address"
              value={address}
              onChange={(event) => setAddress(event.currentTarget.value)}
              maxLength={400}
            />
          </div>

          <div>
            <Label htmlFor="shop-phone">Phone</Label>
            <Input
              id="shop-phone"
              value={phone}
              onChange={(event) => setPhone(event.currentTarget.value)}
              maxLength={40}
              inputMode="tel"
            />
          </div>

          {error && <FieldError>{error}</FieldError>}
        </DialogContent>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} loadingText="Saving…">
            Add shop
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
