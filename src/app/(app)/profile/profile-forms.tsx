'use client'

import * as React from 'react'
import { KeyRound, Save } from 'lucide-react'
import { changeOwnPassword, updateOwnProfile } from '@/server/actions/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FieldError, FieldHint, Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'

export function ProfileForm({
  name: initialName,
  email,
  phone: initialPhone,
  roleName,
  roleDescription,
}: {
  name: string
  email: string
  phone: string
  roleName: string
  roleDescription: string
}) {
  const [name, setName] = React.useState(initialName)
  const [phone, setPhone] = React.useState(initialPhone)
  const [saved, setSaved] = React.useState({ name: initialName, phone: initialPhone })
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const dirty = name !== saved.name || phone !== saved.phone

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (name.trim().length === 0) {
      setError('Your name cannot be empty.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const result = await updateOwnProfile({ name: name.trim(), phone: phone.trim() })
      if (!result.ok) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      setName(result.name)
      setPhone(result.phone ?? '')
      setSaved({ name: result.name, phone: result.phone ?? '' })
      toast.success('Your details were saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardHeader bordered>
          <CardTitle>Your details</CardTitle>
          <CardDescription>Your name is shown next to everything you do.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <div>
            <Label htmlFor="profile-name" required>
              Name
            </Label>
            <Input
              id="profile-name"
              className="mt-1.5 max-w-md"
              value={name}
              autoComplete="name"
              disabled={busy}
              aria-invalid={error ? true : undefined}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" className="mt-1.5 max-w-md" value={email} readOnly disabled />
            <FieldHint>Only an administrator can change your email address.</FieldHint>
          </div>

          <div>
            <Label htmlFor="profile-phone">Phone</Label>
            <Input
              id="profile-phone"
              className="mt-1.5 max-w-md"
              value={phone}
              type="tel"
              autoComplete="tel"
              placeholder="01XXXXXXXXX"
              disabled={busy}
              onChange={(e) => setPhone(e.target.value)}
            />
            <FieldHint>Optional. Used only so colleagues can reach you.</FieldHint>
          </div>

          <div>
            <span className="text-sm font-medium text-foreground">Role</span>
            <div className="mt-1.5">
              <Badge variant="info" title={roleDescription}>
                {roleName}
              </Badge>
            </div>
            <FieldHint>{roleDescription}</FieldHint>
          </div>

          {error && <FieldError>{error}</FieldError>}
        </CardContent>

        <CardFooter bordered>
          <Button
            type="submit"
            disabled={!dirty || busy}
            loading={busy}
            loadingText="Saving…"
            leftIcon={<Save className="size-4" aria-hidden="true" />}
          >
            Save changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

export function PasswordCard() {
  const [current, setCurrent] = React.useState('')
  const [next, setNext] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [errors, setErrors] = React.useState<{ current?: string; next?: string; confirm?: string }>({})
  const [busy, setBusy] = React.useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()

    // Check what we can before troubling the server.
    const found: typeof errors = {}
    if (current.length === 0) found.current = 'Enter your current password.'
    if (next.length < 8) found.next = 'Use at least 8 characters.'
    if (next.length > 0 && next === current) found.next = 'Pick a password you have not used here.'
    if (confirm !== next) found.confirm = 'The two passwords do not match.'
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setBusy(true)
    try {
      const result = await changeOwnPassword({ currentPassword: current, newPassword: next })
      if (!result.ok) {
        setErrors({ current: result.error })
        toast.error(result.error)
        return
      }
      setCurrent('')
      setNext('')
      setConfirm('')
      toast.success('Your password was changed. Other devices have been signed out.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardHeader bordered>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            Use at least 8 characters. Changing it signs you out everywhere else.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <div>
            <Label htmlFor="password-current" required>
              Current password
            </Label>
            <Input
              id="password-current"
              className="mt-1.5 max-w-md"
              type="password"
              autoComplete="current-password"
              value={current}
              disabled={busy}
              aria-invalid={errors.current ? true : undefined}
              onChange={(e) => setCurrent(e.target.value)}
            />
            {errors.current && <FieldError>{errors.current}</FieldError>}
          </div>

          <div>
            <Label htmlFor="password-new" required>
              New password
            </Label>
            <Input
              id="password-new"
              className="mt-1.5 max-w-md"
              type="password"
              autoComplete="new-password"
              value={next}
              disabled={busy}
              aria-invalid={errors.next ? true : undefined}
              onChange={(e) => setNext(e.target.value)}
            />
            {errors.next ? (
              <FieldError>{errors.next}</FieldError>
            ) : (
              <FieldHint>At least 8 characters.</FieldHint>
            )}
          </div>

          <div>
            <Label htmlFor="password-confirm" required>
              New password again
            </Label>
            <Input
              id="password-confirm"
              className="mt-1.5 max-w-md"
              type="password"
              autoComplete="new-password"
              value={confirm}
              disabled={busy}
              aria-invalid={errors.confirm ? true : undefined}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {errors.confirm && <FieldError>{errors.confirm}</FieldError>}
          </div>
        </CardContent>

        <CardFooter bordered>
          <Button
            type="submit"
            disabled={busy}
            loading={busy}
            loadingText="Changing…"
            leftIcon={<KeyRound className="size-4" aria-hidden="true" />}
          >
            Change password
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
