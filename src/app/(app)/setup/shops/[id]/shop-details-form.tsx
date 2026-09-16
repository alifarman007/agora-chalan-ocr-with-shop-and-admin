'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  FieldError,
  FieldHint,
  Input,
  Label,
  Textarea,
  toast,
} from '@/components/ui'
import { updateShop } from '@/server/actions/setup'

type Shop = {
  id: string
  code: string
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
}

export function ShopDetailsForm({ shop }: { shop: Shop }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(shop.name)
  const [address, setAddress] = useState(shop.address ?? '')
  const [phone, setPhone] = useState(shop.phone ?? '')
  const [confirmOpen, setConfirmOpen] = useState(false)

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateShop({ shopId: shop.id, name, address, phone })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success('Shop saved.')
      router.refresh()
    })
  }

  function toggleActive() {
    startTransition(async () => {
      const result = await updateShop({ shopId: shop.id, isActive: !shop.isActive })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(shop.isActive ? 'Shop switched off.' : 'Shop switched on.')
      setConfirmOpen(false)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader bordered>
        <CardTitle>Shop details</CardTitle>
      </CardHeader>

      <form onSubmit={save}>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="code">Shop code</Label>
            <Input id="code" value={shop.code} readOnly disabled className="font-mono" />
            <FieldHint>Fixed for life. Documents are filed under this code.</FieldHint>
          </div>

          <div>
            <Label htmlFor="name" required>
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              maxLength={120}
              required
            />
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(event) => setAddress(event.currentTarget.value)}
              maxLength={400}
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(event) => setPhone(event.currentTarget.value)}
              maxLength={40}
              inputMode="tel"
            />
          </div>

          {error && <FieldError>{error}</FieldError>}
        </CardContent>

        <CardFooter bordered className="flex-wrap justify-between gap-3">
          <Button
            type="button"
            variant={shop.isActive ? 'outline' : 'secondary'}
            onClick={() => setConfirmOpen(true)}
            disabled={pending}
          >
            {shop.isActive ? 'Switch this shop off' : 'Switch this shop back on'}
          </Button>
          <Button type="submit" loading={pending} loadingText="Saving…">
            Save changes
          </Button>
        </CardFooter>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={shop.isActive ? 'Switch this shop off?' : 'Switch this shop back on?'}
        description={
          shop.isActive
            ? 'Nobody will be able to upload into it. Its old documents stay exactly as they are — a shop is never deleted.'
            : 'Staff linked to this shop will be able to upload into it again.'
        }
        confirmLabel={shop.isActive ? 'Switch off' : 'Switch on'}
        destructive={shop.isActive}
        onConfirm={toggleActive}
      />
    </Card>
  )
}
