'use server'

/**
 * Setup actions: shops, users and shop memberships.
 *
 * Every export starts with a permission check on the SERVER. Hiding a button is never
 * the control — a Server Action POSTs to the page route and bypasses proxy.ts matchers
 * entirely, so the check has to live here.
 *
 * Every write that changes setup also writes one audit row with { before, after }, so
 * "who changed this shop's phone number, and when?" always has an answer.
 *
 * Passwords are never hashed by this file. Hashing stays inside Better Auth: we take
 * its resolved context (`auth.$context`) and use `password.hash` plus the internal
 * adapter, exactly as Better Auth's own sign-up route does.
 */
import { revalidatePath } from 'next/cache'
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import {
  auditLog,
  documents,
  sessions,
  shopMemberships,
  shops,
  users,
} from '@/db/schema'
import { auth } from '@/lib/auth/auth'
import { AuthError, requireActor, requirePermission, type Actor } from '@/lib/auth/session'
import { ROLE_CODES, ROLE_META, type RoleCode } from '@/lib/permissions'

// ── shared plumbing ─────────────────────────────────────────────────────────

export type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string }

function fail(error: unknown): { ok: false; error: string; code?: string } {
  if (error instanceof AuthError) return { ok: false, error: error.message, code: error.code }
  if (error instanceof z.ZodError) {
    const first = error.issues[0]
    return { ok: false, error: first?.message ?? 'That does not look right.', code: 'INVALID' }
  }
  console.error('[setup action]', error)
  return { ok: false, error: 'Something went wrong. Please try again.' }
}

/** Postgres unique-constraint violation. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  )
}

async function writeAudit(
  actorUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  before: unknown,
  after: unknown,
) {
  await db.insert(auditLog).values({
    actorUserId,
    action,
    targetType,
    targetId,
    details: { before: before ?? null, after: after ?? null },
  })
}

// ════════════════════════════════════════════════════════════════════════════
// SHOPS
// ════════════════════════════════════════════════════════════════════════════

export type ShopListRow = {
  id: string
  code: string
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
  documentCount: number
  createdAt: Date
}

const listShopsInput = z
  .object({ includeInactive: z.boolean().optional() })
  .optional()

/**
 * Shops the signed-in person may see, with how many documents each one holds.
 * Reads are scoped by the actor's read scope, never by the caller's wishes.
 */
export async function listShops(
  raw?: z.input<typeof listShopsInput>,
): Promise<ActionResult<{ shops: ShopListRow[] }>> {
  try {
    const input = listShopsInput.parse(raw) ?? {}
    const actor = await requireActor()

    const scope = actor.readScope
    if (scope !== 'all' && scope.length === 0) return { ok: true, shops: [] }

    const conditions = [
      scope === 'all' ? undefined : inArray(shops.id, scope),
      input.includeInactive ? undefined : eq(shops.isActive, true),
    ].filter(Boolean)

    const rows = await db
      .select({
        id: shops.id,
        code: shops.code,
        name: shops.name,
        address: shops.address,
        phone: shops.phone,
        isActive: shops.isActive,
        createdAt: shops.createdAt,
        documentCount: sql<number>`count(${documents.id})::int`,
      })
      .from(shops)
      .leftJoin(documents, eq(documents.shopId, shops.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(shops.id)
      .orderBy(asc(shops.name))

    return { ok: true, shops: rows }
  } catch (error) {
    return fail(error)
  }
}

const shopCode = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .refine((value) => value.length >= 2 && value.length <= 20, {
    message: 'The shop code must be 2 to 20 characters.',
  })
  .refine((value) => /^[A-Z0-9-]+$/.test(value), {
    message: 'The shop code can only use capital letters, numbers and dashes.',
  })

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => {
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    })
    .nullish()
    .transform((value) => value ?? null)

const createShopInput = z.object({
  code: shopCode,
  name: z.string().trim().min(2, 'Give the shop a name.').max(120),
  address: optionalText(400),
  phone: optionalText(40),
})

/** Creates a shop. The code is fixed from here on, because documents point at it. */
export async function createShop(
  raw: z.input<typeof createShopInput>,
): Promise<ActionResult<{ shopId: string }>> {
  try {
    const input = createShopInput.parse(raw)
    const actor = await requirePermission('shop.manage')

    let created: { id: string }
    try {
      const inserted = await db
        .insert(shops)
        .values({
          code: input.code,
          name: input.name,
          address: input.address,
          phone: input.phone,
          createdByUserId: actor.id,
        })
        .returning({ id: shops.id })
      created = inserted[0]!
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { ok: false, error: 'A shop with that code already exists.', code: 'DUPLICATE' }
      }
      throw error
    }

    await writeAudit(actor.id, 'shop.create', 'shop', created.id, null, {
      code: input.code,
      name: input.name,
      address: input.address,
      phone: input.phone,
      isActive: true,
    })

    revalidatePath('/setup/shops')
    revalidatePath('/setup/approvers')
    return { ok: true, shopId: created.id }
  } catch (error) {
    return fail(error)
  }
}

const updateShopInput = z.object({
  shopId: z.uuid(),
  name: z.string().trim().min(2, 'Give the shop a name.').max(120).optional(),
  address: optionalText(400).optional(),
  phone: optionalText(40).optional(),
  isActive: z.boolean().optional(),
})

/**
 * Edits a shop. The code can never change, and there is no delete — a shop is
 * deactivated instead, so old documents keep a shop that really exists.
 */
export async function updateShop(
  raw: z.input<typeof updateShopInput>,
): Promise<ActionResult> {
  try {
    const input = updateShopInput.parse(raw)
    const actor = await requirePermission('shop.manage')

    const before = await db.query.shops.findFirst({ where: eq(shops.id, input.shopId) })
    if (!before) return { ok: false, error: 'That shop does not exist.', code: 'NOT_FOUND' }

    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (input.name !== undefined) patch.name = input.name
    if (input.address !== undefined) patch.address = input.address
    if (input.phone !== undefined) patch.phone = input.phone
    if (input.isActive !== undefined) patch.isActive = input.isActive

    await db.update(shops).set(patch).where(eq(shops.id, input.shopId))

    await writeAudit(
      actor.id,
      'shop.update',
      'shop',
      input.shopId,
      {
        name: before.name,
        address: before.address,
        phone: before.phone,
        isActive: before.isActive,
      },
      {
        name: input.name ?? before.name,
        address: input.address !== undefined ? input.address : before.address,
        phone: input.phone !== undefined ? input.phone : before.phone,
        isActive: input.isActive ?? before.isActive,
      },
    )

    revalidatePath('/setup/shops')
    revalidatePath(`/setup/shops/${input.shopId}`)
    revalidatePath('/setup/approvers')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

// ════════════════════════════════════════════════════════════════════════════
// USERS
// ════════════════════════════════════════════════════════════════════════════

export type UserListRow = {
  id: string
  name: string
  email: string
  phone: string | null
  roleCode: RoleCode
  isActive: boolean
  mustChangePassword: boolean
  memberShopCount: number
  approverShopCount: number
  createdAt: Date
}

/**
 * Which roles this person may hand out.
 *
 * Two rules, from CLAUDE.md:
 *   - only a Super Admin may grant or take away the Super Admin role;
 *   - everybody else may only assign a role ranked strictly below their own.
 * A Super Admin is therefore the one person who can create another Super Admin;
 * without that exception the first rule could never be used.
 */
export async function assignableRoles(): Promise<RoleCode[]> {
  const actor = await requireActor()
  return rolesAssignableBy(actor)
}

function rolesAssignableBy(actor: Actor): RoleCode[] {
  if (actor.roleCode === 'super_admin') return [...ROLE_CODES]
  const myRank = ROLE_META[actor.roleCode].rank
  return ROLE_CODES.filter(
    (code) => code !== 'super_admin' && ROLE_META[code].rank < myRank,
  )
}

function assertCanAssignRole(actor: Actor, role: RoleCode): void {
  if (rolesAssignableBy(actor).includes(role)) return
  if (role === 'super_admin') {
    throw new AuthError('Only a Super Admin can give someone the Super Admin role.', 'FORBIDDEN')
  }
  throw new AuthError(
    `You can only give someone a role below your own (${ROLE_META[actor.roleCode].name}).`,
    'FORBIDDEN',
  )
}

function assertCanTouchSuperAdmin(actor: Actor, targetRole: RoleCode): void {
  if (targetRole === 'super_admin' && actor.roleCode !== 'super_admin') {
    throw new AuthError('Only a Super Admin can change another Super Admin.', 'FORBIDDEN')
  }
}

/** How many Super Admins are still switched on. */
async function activeSuperAdminCount(): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.roleCode, 'super_admin'), eq(users.isActive, true)))
  return rows[0]?.n ?? 0
}

const listUsersInput = z
  .object({
    search: z.string().max(120).optional(),
    roleCode: z.enum(ROLE_CODES).optional(),
    includeInactive: z.boolean().optional(),
  })
  .optional()

export async function listUsers(
  raw?: z.input<typeof listUsersInput>,
): Promise<ActionResult<{ users: UserListRow[] }>> {
  try {
    const input = listUsersInput.parse(raw) ?? {}
    await requirePermission('user.manage')

    const term = input.search?.trim()
    const conditions = [
      input.includeInactive ? undefined : eq(users.isActive, true),
      input.roleCode ? eq(users.roleCode, input.roleCode) : undefined,
      term
        ? or(ilike(users.name, `%${term}%`), ilike(users.email, `%${term}%`))
        : undefined,
    ].filter(Boolean)

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        roleCode: users.roleCode,
        isActive: users.isActive,
        mustChangePassword: users.mustChangePassword,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(users.name))

    const counts = await db
      .select({
        userId: shopMemberships.userId,
        kind: shopMemberships.kind,
        n: sql<number>`count(*)::int`,
      })
      .from(shopMemberships)
      .groupBy(shopMemberships.userId, shopMemberships.kind)

    const memberCounts = new Map<string, number>()
    const approverCounts = new Map<string, number>()
    for (const row of counts) {
      if (row.kind === 'approver') approverCounts.set(row.userId, row.n)
      else memberCounts.set(row.userId, row.n)
    }

    return {
      ok: true,
      users: rows.map((row) => ({
        ...row,
        roleCode: row.roleCode as RoleCode,
        memberShopCount: memberCounts.get(row.id) ?? 0,
        approverShopCount: approverCounts.get(row.id) ?? 0,
      })),
    }
  } catch (error) {
    return fail(error)
  }
}

const temporaryPassword = z
  .string()
  .min(8, 'A temporary password must be at least 8 characters.')
  .max(128, 'That password is too long.')

const createUserInput = z.object({
  name: z.string().trim().min(2, 'Give the person a name.').max(120),
  email: z.email('That does not look like an email address.').max(200),
  roleCode: z.enum(ROLE_CODES),
  phone: optionalText(40),
  temporaryPassword,
})

/**
 * Creates a sign-in account.
 *
 * The credential account is made through Better Auth's own context, so password
 * hashing never leaves the library. This mirrors Better Auth 1.7.5's sign-up route
 * (hash -> createUser -> linkAccount with providerId 'credential'); the public
 * sign-up endpoint itself is off, because only an admin may make accounts.
 */
export async function createUser(
  raw: z.input<typeof createUserInput>,
): Promise<ActionResult<{ userId: string }>> {
  try {
    const input = createUserInput.parse(raw)
    const actor = await requirePermission('user.manage')
    assertCanAssignRole(actor, input.roleCode)

    const email = input.email.trim().toLowerCase()

    const authContext = await auth.$context
    const existing = await authContext.internalAdapter.findUserByEmail(email)
    if (existing?.user) {
      return { ok: false, error: 'Somebody already uses that email address.', code: 'DUPLICATE' }
    }

    // Hash first, exactly like Better Auth's sign-up route: if hashing is going to
    // fail, it must fail before a half-made user row exists.
    const hash = await authContext.password.hash(input.temporaryPassword)

    let createdId: string
    try {
      const created = await authContext.internalAdapter.createUser(
        { name: input.name, email, emailVerified: false },
        { method: 'email-password' },
      )
      createdId = created.id
      await authContext.internalAdapter.linkAccount({
        userId: created.id,
        providerId: 'credential',
        accountId: created.id,
        password: hash,
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { ok: false, error: 'Somebody already uses that email address.', code: 'DUPLICATE' }
      }
      throw error
    }

    // Our own columns. Better Auth does not own these, so we set them directly.
    await db
      .update(users)
      .set({
        roleCode: input.roleCode,
        phone: input.phone,
        createdByUserId: actor.id,
        mustChangePassword: true,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, createdId))

    await writeAudit(actor.id, 'user.create', 'user', createdId, null, {
      name: input.name,
      email,
      roleCode: input.roleCode,
      phone: input.phone,
      isActive: true,
    })

    revalidatePath('/setup/users')
    revalidatePath('/setup/approvers')
    return { ok: true, userId: createdId }
  } catch (error) {
    return fail(error)
  }
}

const updateUserInput = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(2, 'Give the person a name.').max(120).optional(),
  roleCode: z.enum(ROLE_CODES).optional(),
  phone: optionalText(40).optional(),
})

export async function updateUser(raw: z.input<typeof updateUserInput>): Promise<ActionResult> {
  try {
    const input = updateUserInput.parse(raw)
    const actor = await requirePermission('user.manage')

    const before = await db.query.users.findFirst({ where: eq(users.id, input.userId) })
    if (!before) return { ok: false, error: 'That person does not exist.', code: 'NOT_FOUND' }

    const beforeRole = before.roleCode as RoleCode
    const roleIsChanging = input.roleCode !== undefined && input.roleCode !== beforeRole

    if (roleIsChanging) {
      if (actor.id === input.userId) {
        throw new AuthError('You cannot change your own role.', 'FORBIDDEN')
      }
      assertCanTouchSuperAdmin(actor, beforeRole)
      assertCanAssignRole(actor, input.roleCode!)

      if (beforeRole === 'super_admin' && (await activeSuperAdminCount()) <= 1) {
        return {
          ok: false,
          error: 'This is the last active Super Admin. Make somebody else a Super Admin first.',
          code: 'LAST_SUPER_ADMIN',
        }
      }
    } else {
      assertCanTouchSuperAdmin(actor, beforeRole)
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (input.name !== undefined) patch.name = input.name
    if (input.phone !== undefined) patch.phone = input.phone
    if (roleIsChanging) patch.roleCode = input.roleCode

    await db.update(users).set(patch).where(eq(users.id, input.userId))

    await writeAudit(
      actor.id,
      'user.update',
      'user',
      input.userId,
      { name: before.name, phone: before.phone, roleCode: beforeRole },
      {
        name: input.name ?? before.name,
        phone: input.phone !== undefined ? input.phone : before.phone,
        roleCode: roleIsChanging ? input.roleCode : beforeRole,
      },
    )

    revalidatePath('/setup/users')
    revalidatePath(`/setup/users/${input.userId}`)
    revalidatePath('/setup/approvers')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

const setUserActiveInput = z.object({
  userId: z.string().min(1),
  isActive: z.boolean(),
})

/**
 * Switches an account on or off. Switching off also deletes that person's sessions,
 * so they are signed out straight away rather than at the end of the week.
 */
export async function setUserActive(
  raw: z.input<typeof setUserActiveInput>,
): Promise<ActionResult> {
  try {
    const input = setUserActiveInput.parse(raw)
    const actor = await requirePermission('user.manage')

    const before = await db.query.users.findFirst({ where: eq(users.id, input.userId) })
    if (!before) return { ok: false, error: 'That person does not exist.', code: 'NOT_FOUND' }
    if (before.isActive === input.isActive) return { ok: true }

    const beforeRole = before.roleCode as RoleCode

    if (!input.isActive) {
      if (actor.id === input.userId) {
        throw new AuthError('You cannot switch off your own account.', 'FORBIDDEN')
      }
      assertCanTouchSuperAdmin(actor, beforeRole)
      if (beforeRole === 'super_admin' && (await activeSuperAdminCount()) <= 1) {
        return {
          ok: false,
          error: 'This is the last active Super Admin. Somebody must stay in charge.',
          code: 'LAST_SUPER_ADMIN',
        }
      }
    } else {
      assertCanTouchSuperAdmin(actor, beforeRole)
    }

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ isActive: input.isActive, updatedAt: new Date() })
        .where(eq(users.id, input.userId))
      if (!input.isActive) {
        // Sign them out now. A live cookie must not outlive the account.
        await tx.delete(sessions).where(eq(sessions.userId, input.userId))
      }
    })

    await writeAudit(
      actor.id,
      input.isActive ? 'user.activate' : 'user.deactivate',
      'user',
      input.userId,
      { isActive: before.isActive },
      { isActive: input.isActive },
    )

    revalidatePath('/setup/users')
    revalidatePath(`/setup/users/${input.userId}`)
    revalidatePath('/setup/approvers')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

const resetUserPasswordInput = z.object({
  userId: z.string().min(1),
  temporaryPassword,
})

/**
 * Sets a new temporary password. Hashing happens inside Better Auth; the plain text
 * is never stored and never written to the audit log.
 */
export async function resetUserPassword(
  raw: z.input<typeof resetUserPasswordInput>,
): Promise<ActionResult> {
  try {
    const input = resetUserPasswordInput.parse(raw)
    const actor = await requirePermission('user.manage')

    const target = await db.query.users.findFirst({ where: eq(users.id, input.userId) })
    if (!target) return { ok: false, error: 'That person does not exist.', code: 'NOT_FOUND' }
    assertCanTouchSuperAdmin(actor, target.roleCode as RoleCode)

    const authContext = await auth.$context
    const hash = await authContext.password.hash(input.temporaryPassword)

    const credential = await authContext.internalAdapter.findCredentialAccount(input.userId)
    if (credential) {
      await authContext.internalAdapter.updatePassword(input.userId, hash)
    } else {
      // No email/password account yet (for example one made before this screen existed).
      await authContext.internalAdapter.linkAccount({
        userId: input.userId,
        providerId: 'credential',
        accountId: input.userId,
        password: hash,
      })
    }

    await db
      .update(users)
      .set({ mustChangePassword: true, updatedAt: new Date() })
      .where(eq(users.id, input.userId))

    await writeAudit(
      actor.id,
      'user.reset_password',
      'user',
      input.userId,
      { mustChangePassword: target.mustChangePassword },
      { mustChangePassword: true },
    )

    revalidatePath(`/setup/users/${input.userId}`)
    revalidatePath('/setup/users')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

// ════════════════════════════════════════════════════════════════════════════
// MEMBERSHIPS
// ════════════════════════════════════════════════════════════════════════════

export type MembershipRow = {
  userId: string
  userName: string
  userEmail: string
  userRoleCode: RoleCode
  userIsActive: boolean
  shopId: string
  shopName: string
  shopCode: string
  shopIsActive: boolean
}

const listMembershipsInput = z.union([
  z.object({ userId: z.string().min(1) }),
  z.object({ shopId: z.uuid() }),
])

/**
 * Both kinds of link at once, either for one person or for one shop.
 *   members   — may work in the shop
 *   approvers — may approve the shop's documents
 */
export async function listMemberships(
  raw: z.input<typeof listMembershipsInput>,
): Promise<ActionResult<{ members: MembershipRow[]; approvers: MembershipRow[] }>> {
  try {
    const input = listMembershipsInput.parse(raw)
    await requirePermission('membership.manage')

    const where =
      'userId' in input
        ? eq(shopMemberships.userId, input.userId)
        : eq(shopMemberships.shopId, input.shopId)

    const rows = await db
      .select({
        kind: shopMemberships.kind,
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        userRoleCode: users.roleCode,
        userIsActive: users.isActive,
        shopId: shops.id,
        shopName: shops.name,
        shopCode: shops.code,
        shopIsActive: shops.isActive,
      })
      .from(shopMemberships)
      .innerJoin(users, eq(users.id, shopMemberships.userId))
      .innerJoin(shops, eq(shops.id, shopMemberships.shopId))
      .where(where)
      .orderBy(asc(users.name), asc(shops.name))

    const members: MembershipRow[] = []
    const approvers: MembershipRow[] = []
    for (const row of rows) {
      const { kind, ...rest } = row
      const entry: MembershipRow = { ...rest, userRoleCode: rest.userRoleCode as RoleCode }
      if (kind === 'approver') approvers.push(entry)
      else members.push(entry)
    }

    return { ok: true, members, approvers }
  } catch (error) {
    return fail(error)
  }
}

const setMembershipsInput = z.object({
  userId: z.string().min(1),
  shopIds: z.array(z.uuid()).max(500),
  kind: z.enum(['member', 'approver']),
})

/**
 * Replaces the WHOLE set of shops for one person and one kind, in one transaction.
 *
 * Sending the same list twice changes nothing, so a double-clicked Save is harmless.
 */
export async function setMemberships(
  raw: z.input<typeof setMembershipsInput>,
): Promise<ActionResult<{ count: number }>> {
  try {
    const input = setMembershipsInput.parse(raw)
    const actor = await requirePermission('membership.manage')

    const target = await db.query.users.findFirst({ where: eq(users.id, input.userId) })
    if (!target) return { ok: false, error: 'That person does not exist.', code: 'NOT_FOUND' }

    const wanted = [...new Set(input.shopIds)]

    if (wanted.length > 0) {
      const found = await db
        .select({ id: shops.id })
        .from(shops)
        .where(inArray(shops.id, wanted))
      if (found.length !== wanted.length) {
        return { ok: false, error: 'One of those shops does not exist.', code: 'NOT_FOUND' }
      }
    }

    const beforeRows = await db
      .select({ shopId: shopMemberships.shopId })
      .from(shopMemberships)
      .where(
        and(eq(shopMemberships.userId, input.userId), eq(shopMemberships.kind, input.kind)),
      )
    const before = beforeRows.map((row) => row.shopId).sort()

    await db.transaction(async (tx) => {
      await tx
        .delete(shopMemberships)
        .where(
          and(eq(shopMemberships.userId, input.userId), eq(shopMemberships.kind, input.kind)),
        )
      if (wanted.length > 0) {
        await tx.insert(shopMemberships).values(
          wanted.map((shopId) => ({
            userId: input.userId,
            shopId,
            kind: input.kind,
            createdByUserId: actor.id,
          })),
        )
      }
    })

    const after = [...wanted].sort()
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await writeAudit(
        actor.id,
        'membership.set',
        'user',
        input.userId,
        { kind: input.kind, shopIds: before },
        { kind: input.kind, shopIds: after },
      )
    }

    revalidatePath('/setup/users')
    revalidatePath(`/setup/users/${input.userId}`)
    revalidatePath('/setup/shops')
    revalidatePath('/setup/approvers')
    for (const shopId of new Set([...before, ...after])) {
      revalidatePath(`/setup/shops/${shopId}`)
    }

    return { ok: true, count: wanted.length }
  } catch (error) {
    return fail(error)
  }
}

// ── small reads the setup screens need ──────────────────────────────────────

export type ShopOption = {
  id: string
  code: string
  name: string
  isActive: boolean
}

/** Every shop, for the checkbox grids and the approver matrix. */
export async function listShopOptions(): Promise<ActionResult<{ shops: ShopOption[] }>> {
  try {
    await requirePermission('membership.manage')
    const rows = await db
      .select({
        id: shops.id,
        code: shops.code,
        name: shops.name,
        isActive: shops.isActive,
      })
      .from(shops)
      .orderBy(desc(shops.isActive), asc(shops.name))
    return { ok: true, shops: rows }
  } catch (error) {
    return fail(error)
  }
}
