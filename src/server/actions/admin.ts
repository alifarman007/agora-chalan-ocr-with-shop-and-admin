'use server'

/**
 * Admin actions: Master Control, the role grid, the audit log and a user's own profile.
 *
 * Every action starts with a permission check on the SERVER. Hiding a button is never
 * the check — a Server Action POSTs to the page route and bypasses proxy.ts matchers
 * entirely.
 *
 * Nothing here throws to the client. Each action returns a discriminated result, and
 * the real cause is logged on the server.
 */
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { APIError } from 'better-auth/api'
import { db } from '@/db'
import { auditLog, rolePermissions, users } from '@/db/schema'
import { auth } from '@/lib/auth/auth'
import { AuthError, requireActor, requirePermission } from '@/lib/auth/session'
import {
  PERMISSIONS,
  ROLE_CODES,
  isPermission,
  isRoleCode,
  type Permission,
  type RoleCode,
} from '@/lib/permissions'
import { dhakaDayRange } from '@/lib/format'
import { writeSettings } from '@/server/settings'

export type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string }

function fail(error: unknown): { ok: false; error: string; code?: string } {
  if (error instanceof AuthError) return { ok: false, error: error.message, code: error.code }
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? 'That input is not valid.', code: 'INVALID' }
  }
  console.error('[admin action]', error)
  return { ok: false, error: 'Something went wrong. Please try again.' }
}

// ── 1. Master Control ────────────────────────────────────────────────────────

/**
 * Writes the given settings keys. `writeSettings` validates each key on its own,
 * writes the audit row and clears the settings cache, so one bad key never blocks
 * the good ones.
 */
export async function updateSettings(
  updates: Record<string, unknown>,
): Promise<ActionResult<{ changed: string[]; errors: Record<string, string> }>> {
  try {
    const actor = await requirePermission('settings.manage')

    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return { ok: false, error: 'Nothing to save.' }
    }

    const { changed, errors } = await writeSettings(updates, actor.id)

    if (changed.length > 0) {
      revalidatePath('/settings')
      revalidatePath('/', 'layout')
    }
    return { ok: true, changed, errors }
  } catch (error) {
    return fail(error)
  }
}

// ── 2. The role x permission grid ────────────────────────────────────────────

export type RoleGrid = Record<RoleCode, Permission[]>

/**
 * The granted permission codes for every role.
 *
 * super_admin is reported as "everything" because that is what the server does at
 * runtime: its stored rows are ignored, so the grid can never lock the owner out.
 */
export async function getRolePermissions(): Promise<ActionResult<{ grid: RoleGrid }>> {
  try {
    await requirePermission('role.manage')

    const rows = await db
      .select({ roleCode: rolePermissions.roleCode, code: rolePermissions.permissionCode })
      .from(rolePermissions)

    const grid = {} as RoleGrid
    for (const code of ROLE_CODES) grid[code] = []
    for (const row of rows) {
      if (!isRoleCode(row.roleCode)) continue
      if (!isPermission(row.code)) continue
      if (row.roleCode === 'super_admin') continue
      grid[row.roleCode].push(row.code)
    }
    grid.super_admin = [...PERMISSIONS]

    return { ok: true, grid }
  } catch (error) {
    return fail(error)
  }
}

const setRolePermissionsInput = z.object({
  roleCode: z.string().min(1),
  permissionCodes: z.array(z.string()).max(200),
})

/**
 * Replaces the whole permission set for ONE role, inside a transaction, so the grid
 * is never half-saved. Codes the server does not know are dropped silently.
 */
export async function setRolePermissions(
  raw: z.input<typeof setRolePermissionsInput>,
): Promise<ActionResult<{ roleCode: RoleCode; permissionCodes: Permission[] }>> {
  try {
    const input = setRolePermissionsInput.parse(raw)
    const actor = await requirePermission('role.manage')

    if (!isRoleCode(input.roleCode)) {
      return { ok: false, error: 'That role does not exist.' }
    }
    if (input.roleCode === 'super_admin') {
      return {
        ok: false,
        error:
          'super_admin is granted everything in code so nobody can lock themselves out.',
        code: 'FORBIDDEN',
      }
    }

    const roleCode: RoleCode = input.roleCode
    // Unknown codes are dropped without complaint. The vocabulary lives in code.
    const wanted = [...new Set(input.permissionCodes.filter(isPermission))].sort()

    const beforeRows = await db
      .select({ code: rolePermissions.permissionCode })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleCode, roleCode))
    const before = [...new Set(beforeRows.map((r) => r.code).filter(isPermission))].sort()

    const added = wanted.filter((c) => !before.includes(c))
    const removed = before.filter((c) => !wanted.includes(c))

    if (added.length === 0 && removed.length === 0) {
      return { ok: true, roleCode, permissionCodes: wanted }
    }

    await db.transaction(async (tx) => {
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleCode, roleCode))
      if (wanted.length > 0) {
        await tx.insert(rolePermissions).values(
          wanted.map((code) => ({
            roleCode,
            permissionCode: code,
            grantedByUserId: actor.id,
          })),
        )
      }
      await tx.insert(auditLog).values({
        actorUserId: actor.id,
        action: 'role.permissions.update',
        targetType: 'role',
        targetId: roleCode,
        details: { before, after: wanted, added, removed },
      })
    })

    revalidatePath('/settings/roles')
    revalidatePath('/', 'layout')
    return { ok: true, roleCode, permissionCodes: wanted }
  } catch (error) {
    return fail(error)
  }
}

// ── 3. Audit log ─────────────────────────────────────────────────────────────

export type AuditRow = {
  id: number
  createdAt: Date
  action: string
  targetType: string | null
  targetId: string | null
  details: unknown
  actorUserId: string | null
  actorName: string | null
  actorEmail: string | null
}

const listAuditLogInput = z.object({
  search: z.string().trim().max(200).optional(),
  action: z.string().trim().max(120).optional(),
  actorUserId: z.string().trim().max(64).optional(),
  /** Dhaka calendar dates, YYYY-MM-DD. */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
})

export async function listAuditLog(
  raw: z.input<typeof listAuditLogInput> = {},
): Promise<ActionResult<{ rows: AuditRow[]; total: number }>> {
  try {
    await requirePermission('audit.view')
    const input = listAuditLogInput.parse(raw ?? {})

    const conditions = []

    if (input.action) conditions.push(eq(auditLog.action, input.action))
    if (input.actorUserId) conditions.push(eq(auditLog.actorUserId, input.actorUserId))

    if (input.from || input.to) {
      // A day filter means a Dhaka day, not a UTC one.
      const range = dhakaDayRange(input.from ?? '1970-01-01', input.to ?? '2999-12-31')
      if (input.from) conditions.push(gte(auditLog.createdAt, range.start))
      if (input.to) conditions.push(lte(auditLog.createdAt, range.end))
    }

    if (input.search) {
      const pattern = `%${input.search}%`
      const match = or(
        ilike(auditLog.action, pattern),
        ilike(auditLog.targetType, pattern),
        ilike(auditLog.targetId, pattern),
        ilike(users.name, pattern),
        ilike(users.email, pattern),
        sql`${auditLog.details}::text ilike ${pattern}`,
      )
      if (match) conditions.push(match)
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, totals] = await Promise.all([
      db
        .select({
          id: auditLog.id,
          createdAt: auditLog.createdAt,
          action: auditLog.action,
          targetType: auditLog.targetType,
          targetId: auditLog.targetId,
          details: auditLog.details,
          actorUserId: auditLog.actorUserId,
          actorName: users.name,
          actorEmail: users.email,
        })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.actorUserId))
        .where(where)
        .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
        .limit(input.limit)
        .offset(input.offset),
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.actorUserId))
        .where(where),
    ])

    return { ok: true, rows: rows as AuditRow[], total: totals[0]?.value ?? 0 }
  } catch (error) {
    return fail(error)
  }
}

/** The distinct actions actually present, so the filter only offers real options. */
export async function listAuditActions(): Promise<ActionResult<{ actions: string[] }>> {
  try {
    await requirePermission('audit.view')
    const rows = await db
      .selectDistinct({ action: auditLog.action })
      .from(auditLog)
      .orderBy(auditLog.action)
    return { ok: true, actions: rows.map((r) => r.action) }
  } catch (error) {
    return fail(error)
  }
}

// ── 4. The signed-in user's own account ──────────────────────────────────────

const changeOwnPasswordInput = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z
    .string()
    .min(8, 'The new password must be at least 8 characters.')
    .max(128, 'The new password is too long.'),
})

/**
 * Changes the signed-in user's own password.
 *
 * Better Auth owns the password hash, so we go through its server API rather than
 * writing to the account table ourselves. It verifies the current password for us.
 */
export async function changeOwnPassword(
  raw: z.input<typeof changeOwnPasswordInput>,
): Promise<ActionResult> {
  try {
    const input = changeOwnPasswordInput.parse(raw)
    const actor = await requireActor()

    if (input.currentPassword === input.newPassword) {
      return { ok: false, error: 'The new password must be different from the old one.' }
    }

    try {
      await auth.api.changePassword({
        body: {
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          // Signs out every other device. A password change should end old sessions.
          revokeOtherSessions: true,
        },
        headers: await headers(),
      })
    } catch (error) {
      if (error instanceof APIError) {
        console.error('[admin action] changePassword', error.status, error.message)
        return { ok: false, error: 'Your current password is not correct.', code: 'BAD_PASSWORD' }
      }
      throw error
    }

    // The forced-change flag is ours, not Better Auth's.
    await db
      .update(users)
      .set({ mustChangePassword: false, updatedAt: new Date() })
      .where(eq(users.id, actor.id))

    await db.insert(auditLog).values({
      actorUserId: actor.id,
      action: 'user.password.change',
      targetType: 'user',
      targetId: actor.id,
      details: { before: null, after: { changedOwnPassword: true } },
    })

    revalidatePath('/profile')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

const updateOwnProfileInput = z.object({
  name: z.string().trim().min(1, 'Your name cannot be empty.').max(120, 'That name is too long.'),
  phone: z
    .string()
    .trim()
    .max(40, 'That phone number is too long.')
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
})

export async function updateOwnProfile(
  raw: z.input<typeof updateOwnProfileInput>,
): Promise<ActionResult<{ name: string; phone: string | null }>> {
  try {
    const input = updateOwnProfileInput.parse(raw)
    const actor = await requireActor()

    const current = await db.query.users.findFirst({
      where: eq(users.id, actor.id),
      columns: { name: true, phone: true },
    })
    if (!current) return { ok: false, error: 'Your account could not be found.', code: 'NOT_FOUND' }

    if (current.name === input.name && (current.phone ?? null) === input.phone) {
      return { ok: true, name: input.name, phone: input.phone }
    }

    await db
      .update(users)
      .set({ name: input.name, phone: input.phone, updatedAt: new Date() })
      .where(eq(users.id, actor.id))

    await db.insert(auditLog).values({
      actorUserId: actor.id,
      action: 'user.profile.update',
      targetType: 'user',
      targetId: actor.id,
      details: {
        before: { name: current.name, phone: current.phone ?? null },
        after: { name: input.name, phone: input.phone },
      },
    })

    revalidatePath('/profile')
    revalidatePath('/', 'layout')
    return { ok: true, name: input.name, phone: input.phone }
  } catch (error) {
    return fail(error)
  }
}
