'use client'

import * as React from 'react'
import { Info } from 'lucide-react'
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_CODES,
  ROLE_META,
  type Permission,
  type RoleCode,
} from '@/lib/permissions'
import { setRolePermissions } from '@/server/actions/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/components/ui/toast'

type Grid = Record<RoleCode, Permission[]>

const EDITABLE_ROLES = ROLE_CODES.filter((code) => code !== 'super_admin')

function sameSet(a: Permission[], b: Permission[]) {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((value, i) => value === sortedB[i])
}

export function RolesGrid({ grid }: { grid: Grid }) {
  const [saved, setSaved] = React.useState<Grid>(() => cloneGrid(grid))
  const [draft, setDraft] = React.useState<Grid>(() => cloneGrid(grid))
  const [savingRole, setSavingRole] = React.useState<RoleCode | null>(null)

  function has(role: RoleCode, permission: Permission) {
    if (role === 'super_admin') return true
    return draft[role].includes(permission)
  }

  function toggle(role: RoleCode, permission: Permission, on: boolean) {
    if (role === 'super_admin') return
    setDraft((prev) => {
      const current = prev[role]
      const next = on
        ? current.includes(permission)
          ? current
          : [...current, permission]
        : current.filter((p) => p !== permission)
      return { ...prev, [role]: next }
    })
  }

  function toggleGroup(role: RoleCode, permissions: Permission[], on: boolean) {
    if (role === 'super_admin') return
    setDraft((prev) => {
      const current = prev[role]
      const next = on
        ? [...new Set([...current, ...permissions])]
        : current.filter((p) => !permissions.includes(p))
      return { ...prev, [role]: next }
    })
  }

  function isDirty(role: RoleCode) {
    if (role === 'super_admin') return false
    return !sameSet(draft[role], saved[role])
  }

  const dirtyRoles = EDITABLE_ROLES.filter(isDirty)

  async function save(role: RoleCode) {
    if (!isDirty(role)) return
    setSavingRole(role)
    try {
      const result = await setRolePermissions({ roleCode: role, permissionCodes: draft[role] })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setSaved((prev) => ({ ...prev, [role]: [...result.permissionCodes] }))
      setDraft((prev) => ({ ...prev, [role]: [...result.permissionCodes] }))
      toast.success(`Saved ${ROLE_META[role].name}.`)
    } finally {
      setSavingRole(null)
    }
  }

  function reset(role: RoleCode) {
    setDraft((prev) => ({ ...prev, [role]: [...saved[role]] }))
  }

  return (
    <div className="space-y-4">
      <Card flat>
        <CardContent className="flex items-start gap-3 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <div className="space-y-1">
            <p>
              The list of permissions is fixed in code. Only which role has which is editable here.
            </p>
            <p>Super Admin always has every permission, so it can never be locked out.</p>
          </div>
        </CardContent>
      </Card>

      {dirtyRoles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
          <span className="font-medium text-amber-800 dark:text-amber-200">
            Unsaved changes: {dirtyRoles.map((r) => ROLE_META[r].name).join(', ')}
          </span>
          <span className="flex-1" />
          {dirtyRoles.map((role) => (
            <Button key={role} size="sm" variant="ghost" onClick={() => reset(role)}>
              Undo {ROLE_META[role].name}
            </Button>
          ))}
        </div>
      )}

      <Table stickyHeader containerClassName="bg-card">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 min-w-[14rem] bg-muted/60">
              Permission
            </TableHead>
            {ROLE_CODES.map((role) => {
              const dirty = isDirty(role)
              return (
                <TableHead key={role} className="min-w-[8.5rem] text-center align-top">
                  <span
                    className="block cursor-help font-semibold text-foreground"
                    title={ROLE_META[role].description}
                  >
                    {ROLE_META[role].name}
                  </span>
                  <span className="mt-1 block h-7">
                    {role === 'super_admin' ? (
                      <span className="text-xs font-normal text-muted-foreground">Always all</span>
                    ) : dirty ? (
                      <Button
                        size="sm"
                        onClick={() => save(role)}
                        loading={savingRole === role}
                        loadingText="Saving…"
                        disabled={savingRole !== null}
                      >
                        Save
                      </Button>
                    ) : (
                      <span className="text-xs font-normal text-muted-foreground">Saved</span>
                    )}
                  </span>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>

        <TableBody>
          {PERMISSION_GROUPS.map((group) => (
            <React.Fragment key={group.label}>
              <TableRow className="bg-muted/40">
                <TableCell className="sticky left-0 z-10 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </TableCell>
                {ROLE_CODES.map((role) => {
                  const on = group.permissions.filter((p) => has(role, p)).length
                  const all = on === group.permissions.length
                  return (
                    <TableCell key={role} className="bg-muted/40 text-center">
                      <Checkbox
                        checked={all}
                        indeterminate={on > 0 && !all}
                        disabled={role === 'super_admin' || savingRole !== null}
                        aria-label={`Turn every ${group.label} permission on or off for ${ROLE_META[role].name}`}
                        containerClassName="justify-center"
                        onChange={(e) => toggleGroup(role, group.permissions, e.target.checked)}
                      />
                    </TableCell>
                  )
                })}
              </TableRow>

              {group.permissions.map((permission) => (
                <TableRow key={permission}>
                  <TableCell className="sticky left-0 z-10 bg-card">
                    <span className="block text-sm text-foreground">
                      {PERMISSION_LABELS[permission]}
                    </span>
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {permission}
                    </span>
                  </TableCell>
                  {ROLE_CODES.map((role) => (
                    <TableCell key={role} className="text-center">
                      <Checkbox
                        checked={has(role, permission)}
                        disabled={role === 'super_admin' || savingRole !== null}
                        title={
                          role === 'super_admin'
                            ? 'Super Admin always has every permission, so it can never be locked out.'
                            : undefined
                        }
                        aria-label={`${PERMISSION_LABELS[permission]} for ${ROLE_META[role].name}`}
                        containerClassName="justify-center"
                        onChange={(e) => toggle(role, permission, e.target.checked)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-wrap gap-2">
        {EDITABLE_ROLES.map((role) => (
          <Button
            key={role}
            size="sm"
            variant={isDirty(role) ? 'default' : 'outline'}
            disabled={!isDirty(role) || savingRole !== null}
            loading={savingRole === role}
            loadingText="Saving…"
            onClick={() => save(role)}
          >
            Save {ROLE_META[role].name}
          </Button>
        ))}
      </div>
    </div>
  )
}

function cloneGrid(source: Grid): Grid {
  const out = {} as Grid
  for (const role of ROLE_CODES) out[role] = [...(source[role] ?? [])]
  return out
}
