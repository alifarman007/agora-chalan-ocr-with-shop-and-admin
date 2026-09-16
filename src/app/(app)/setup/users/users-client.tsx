'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus, Search, Users } from 'lucide-react'
import {
  Avatar,
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
  Input,
  Label,
  Select,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@/components/ui'
import { ROLE_META, type RoleCode } from '@/lib/permissions'
import { createUser, type UserListRow } from '@/server/actions/setup'
import { RoleBadge } from './role-badge'
import { TemporaryPasswordField, generatePassword } from './password-field'

export function UsersClient({
  users,
  search,
  roleCode,
  includeInactive,
  assignableRoles,
}: {
  users: UserListRow[]
  search: string
  roleCode: string
  includeInactive: boolean
  assignableRoles: RoleCode[]
}) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [term, setTerm] = useState(search)

  function go(next: { q?: string; role?: string; inactive?: boolean }) {
    const params = new URLSearchParams()
    const q = next.q ?? term
    const role = next.role ?? roleCode
    const inactive = next.inactive ?? includeInactive
    if (q.trim()) params.set('q', q.trim())
    if (role) params.set('role', role)
    if (inactive) params.set('inactive', '1')
    const query = params.toString()
    router.push(query ? `/setup/users?${query}` : '/setup/users')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              go({ q: term })
            }}
            className="flex gap-2"
          >
            <Input
              value={term}
              onChange={(event) => setTerm(event.currentTarget.value)}
              placeholder="Search name or email"
              leftIcon={<Search className="size-4" />}
              aria-label="Search users"
              containerClassName="w-full sm:w-64"
            />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>

          <Select
            value={roleCode}
            onChange={(event) => go({ role: event.currentTarget.value })}
            aria-label="Filter by role"
            options={[
              { value: '', label: 'Every role' },
              ...Object.entries(ROLE_META).map(([code, meta]) => ({
                value: code,
                label: meta.name,
              })),
            ]}
            containerClassName="w-full sm:w-48"
          />

          <Checkbox
            checked={includeInactive}
            onChange={(event) => go({ inactive: event.currentTarget.checked })}
            label="Show switched-off accounts"
          />
        </div>

        <Button leftIcon={<Plus className="size-4" />} onClick={() => setAddOpen(true)}>
          Add user
        </Button>
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="No users match"
          description="Try a different search, or add somebody new."
          action={<Button onClick={() => setAddOpen(true)}>Add user</Button>}
        />
      ) : (
        <>
          {/* Phones: one card per person. */}
          <ul className="grid gap-3 md:hidden">
            {users.map((user) => (
              <li key={user.id}>
                <Link
                  href={`/setup/users/${user.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar name={user.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{user.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <RoleBadge roleCode={user.roleCode} />
                      {!user.isActive && <Badge variant="secondary">Off</Badge>}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Tablet and up: the full table. */}
          <div className="hidden md:block">
            <Table zebra containerClassName="rounded-xl border border-border">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead numeric>Shops</TableHead>
                  <TableHead numeric>Approves</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableEmpty colSpan={6}>No users match this filter.</TableEmpty>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow
                      key={user.id}
                      interactive
                      onClick={() => router.push(`/setup/users/${user.id}`)}
                    >
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <Avatar name={user.name} size="xs" />
                          <Link
                            href={`/setup/users/${user.id}`}
                            className="font-medium hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {user.name}
                          </Link>
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <RoleBadge roleCode={user.roleCode} />
                      </TableCell>
                      <TableCell numeric>{user.memberShopCount}</TableCell>
                      <TableCell numeric>{user.approverShopCount}</TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'success' : 'secondary'} dot>
                          {user.isActive ? 'On' : 'Off'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <AddUserDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        assignableRoles={assignableRoles}
      />
    </div>
  )
}

function AddUserDialog({
  open,
  onOpenChange,
  assignableRoles,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignableRoles: RoleCode[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<string>(assignableRoles.includes('shop_user') ? 'shop_user' : (assignableRoles[0] ?? ''))
  const [password, setPassword] = useState(() => generatePassword())

  function reset() {
    setName('')
    setEmail('')
    setPhone('')
    setRole(assignableRoles.includes('shop_user') ? 'shop_user' : (assignableRoles[0] ?? ''))
    setPassword(generatePassword())
    setError(null)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createUser({
        name,
        email,
        roleCode: role as RoleCode,
        phone,
        temporaryPassword: password,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success('User added. Give them the temporary password.')
      const userId = result.userId
      reset()
      onOpenChange(false)
      router.push(`/setup/users/${userId}`)
    })
  }

  if (assignableRoles.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogHeader>
          <DialogTitle>Add a user</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-sm text-muted-foreground">
            Your role cannot give anybody a role, so you cannot add users. Ask an
            administrator.
          </p>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </Dialog>
    )
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
          <DialogTitle>Add a user</DialogTitle>
          <DialogDescription>
            The account is ready straight away. The person signs in with this email and the
            temporary password below.
          </DialogDescription>
        </DialogHeader>

        <DialogContent className="space-y-4">
          <div>
            <Label htmlFor="user-name" required>
              Full name
            </Label>
            <Input
              id="user-name"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              maxLength={120}
              required
            />
          </div>

          <div>
            <Label htmlFor="user-email" required>
              Email
            </Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              maxLength={200}
              autoComplete="off"
              required
            />
          </div>

          <div>
            <Label htmlFor="user-role" required>
              Role
            </Label>
            <Select
              id="user-role"
              value={role}
              onChange={(event) => setRole(event.currentTarget.value)}
              options={assignableRoles.map((code) => ({
                value: code,
                label: ROLE_META[code].name,
              }))}
              required
            />
            {role && (
              <p className="mt-1 text-xs text-muted-foreground">
                {ROLE_META[role as RoleCode].description}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="user-phone">Phone</Label>
            <Input
              id="user-phone"
              value={phone}
              onChange={(event) => setPhone(event.currentTarget.value)}
              maxLength={40}
              inputMode="tel"
            />
          </div>

          <TemporaryPasswordField id="user-password" value={password} onChange={setPassword} />

          {error && <FieldError>{error}</FieldError>}
        </DialogContent>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} loadingText="Creating…">
            Add user
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
