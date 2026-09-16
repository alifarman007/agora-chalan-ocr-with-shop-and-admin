'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { KeyRound } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FieldError,
  FieldHint,
  Input,
  Label,
  Select,
  toast,
} from '@/components/ui'
import { ROLE_META, type RoleCode } from '@/lib/permissions'
import {
  resetUserPassword,
  setMemberships,
  setUserActive,
  updateUser,
  type ShopOption,
} from '@/server/actions/setup'
import { TemporaryPasswordField, generatePassword } from '../password-field'

type UserRow = {
  id: string
  name: string
  email: string
  phone: string | null
  roleCode: RoleCode
  isActive: boolean
  mustChangePassword: boolean
}

export function UserDetail({
  user,
  isSelf,
  assignableRoles,
  canManageMemberships,
  shops,
  memberShopIds,
  approverShopIds,
}: {
  user: UserRow
  isSelf: boolean
  assignableRoles: RoleCode[]
  canManageMemberships: boolean
  shops: ShopOption[]
  memberShopIds: string[]
  approverShopIds: string[]
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <DetailsCard user={user} isSelf={isSelf} assignableRoles={assignableRoles} />
        <AccessCard user={user} isSelf={isSelf} />
      </div>

      {canManageMemberships && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ShopGrid
            title="Can work in these shops"
            hint="Uploading, editing and submitting documents is allowed in the shops ticked here."
            userId={user.id}
            kind="member"
            shops={shops}
            selected={memberShopIds}
          />
          <ShopGrid
            title="Can approve for these shops"
            hint="Approving and rejecting is allowed in the shops ticked here. Admins can already approve everywhere."
            userId={user.id}
            kind="approver"
            shops={shops}
            selected={approverShopIds}
          />
        </div>
      )}
    </div>
  )
}

function DetailsCard({
  user,
  isSelf,
  assignableRoles,
}: {
  user: UserRow
  isSelf: boolean
  assignableRoles: RoleCode[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [role, setRole] = useState<string>(user.roleCode)

  const mayChangeRole = !isSelf && assignableRoles.includes(user.roleCode)
  const roleOptions = [
    ...(assignableRoles.includes(user.roleCode)
      ? []
      : [{ value: user.roleCode, label: `${ROLE_META[user.roleCode].name} (cannot be changed by you)`, disabled: true }]),
    ...assignableRoles.map((code) => ({ value: code, label: ROLE_META[code].name })),
  ]

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateUser({
        userId: user.id,
        name,
        phone,
        roleCode: mayChangeRole ? (role as RoleCode) : undefined,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success('Saved.')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader bordered>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <form onSubmit={save}>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email} readOnly disabled />
            <FieldHint>The sign-in email cannot be changed here.</FieldHint>
          </div>

          <div>
            <Label htmlFor="name" required>
              Full name
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
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(event) => setPhone(event.currentTarget.value)}
              maxLength={40}
              inputMode="tel"
            />
          </div>

          <div>
            <Label htmlFor="role">Role</Label>
            <Select
              id="role"
              value={role}
              onChange={(event) => setRole(event.currentTarget.value)}
              options={roleOptions}
              disabled={!mayChangeRole}
            />
            <FieldHint>
              {isSelf
                ? 'You cannot change your own role. Ask another administrator.'
                : mayChangeRole
                  ? ROLE_META[(role as RoleCode) ?? user.roleCode]?.description
                  : 'This role is at or above your own, so you cannot change it.'}
            </FieldHint>
          </div>

          {error && <FieldError>{error}</FieldError>}
        </CardContent>

        <CardFooter bordered>
          <Button type="submit" loading={pending} loadingText="Saving…">
            Save changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function AccessCard({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  function toggleActive() {
    startTransition(async () => {
      const result = await setUserActive({ userId: user.id, isActive: !user.isActive })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        user.isActive ? 'Account switched off and signed out.' : 'Account switched on.',
      )
      setConfirmOpen(false)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader bordered>
        <CardTitle>Access</CardTitle>
        <CardDescription>Signing in and passwords.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Account state</p>
            <p className="text-xs text-muted-foreground">
              Switching an account off signs the person out right away.
            </p>
          </div>
          <Badge variant={user.isActive ? 'success' : 'secondary'} dot>
            {user.isActive ? 'On' : 'Off'}
          </Badge>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Password</p>
            <p className="text-xs text-muted-foreground">
              {user.mustChangePassword
                ? 'Must be changed at the next sign-in.'
                : 'Chosen by the person.'}
            </p>
          </div>
          {user.mustChangePassword && <Badge variant="warning">Temporary</Badge>}
        </div>
      </CardContent>

      <CardFooter bordered className="flex-wrap justify-between gap-3">
        <Button
          variant="outline"
          leftIcon={<KeyRound className="size-4" />}
          onClick={() => setResetOpen(true)}
          disabled={pending}
        >
          Reset password
        </Button>
        <Button
          variant={user.isActive ? 'destructive' : 'secondary'}
          onClick={() => setConfirmOpen(true)}
          disabled={pending || (isSelf && user.isActive)}
          title={isSelf && user.isActive ? 'You cannot switch off your own account.' : undefined}
        >
          {user.isActive ? 'Switch account off' : 'Switch account on'}
        </Button>
      </CardFooter>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={user.isActive ? 'Switch this account off?' : 'Switch this account on?'}
        description={
          user.isActive
            ? 'They will be signed out at once and will not be able to sign in again until you switch the account back on. Their documents stay exactly as they are.'
            : 'They will be able to sign in again with their existing password.'
        }
        confirmLabel={user.isActive ? 'Switch off' : 'Switch on'}
        destructive={user.isActive}
        onConfirm={toggleActive}
      />

      <ResetPasswordDialog userId={user.id} open={resetOpen} onOpenChange={setResetOpen} />
    </Card>
  )
}

function ResetPasswordDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState(() => generatePassword())

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await resetUserPassword({ userId, temporaryPassword: password })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success('Password reset. Give the new one to the person.')
      onOpenChange(false)
      setPassword(generatePassword())
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Reset the password</DialogTitle>
          <DialogDescription>
            The old password stops working at once. Copy the new one before you close this
            box — it is never shown again.
          </DialogDescription>
        </DialogHeader>
        <DialogContent className="space-y-4">
          <TemporaryPasswordField
            id="reset-password"
            value={password}
            onChange={setPassword}
            label="New temporary password"
          />
          {error && <FieldError>{error}</FieldError>}
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} loadingText="Resetting…">
            Reset password
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

function ShopGrid({
  title,
  hint,
  userId,
  kind,
  shops,
  selected,
}: {
  title: string
  hint: string
  userId: string
  kind: 'member' | 'approver'
  shops: ShopOption[]
  selected: string[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [chosen, setChosen] = useState<string[]>(selected)

  const dirty =
    chosen.length !== selected.length ||
    [...chosen].sort().join(',') !== [...selected].sort().join(',')

  function toggle(shopId: string, on: boolean) {
    setChosen((current) =>
      on ? [...new Set([...current, shopId])] : current.filter((id) => id !== shopId),
    )
  }

  function save() {
    startTransition(async () => {
      const result = await setMemberships({ userId, shopIds: chosen, kind })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Shops saved.')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader bordered>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent>
        {shops.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            There are no shops yet.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {shops.map((shop) => (
              <li key={shop.id}>
                <Checkbox
                  checked={chosen.includes(shop.id)}
                  onChange={(event) => toggle(shop.id, event.currentTarget.checked)}
                  disabled={pending}
                  label={
                    <span className="flex flex-wrap items-center gap-2">
                      <span>{shop.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {shop.code}
                      </span>
                      {!shop.isActive && <Badge variant="secondary" size="sm">Off</Badge>}
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter bordered className="justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => setChosen(selected)}
          disabled={!dirty || pending}
        >
          Undo
        </Button>
        <Button onClick={save} loading={pending} loadingText="Saving…" disabled={!dirty}>
          Save shops
        </Button>
      </CardFooter>
    </Card>
  )
}
