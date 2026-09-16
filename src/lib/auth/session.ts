/**
 * The security core. Every server action and route handler starts here.
 *
 * Three rules this file exists to enforce:
 *   1. Permissions are checked on the SERVER, every time. A hidden button is not a check.
 *   2. Shop scope is a REQUIRED argument on every document query, so it cannot be
 *      forgotten. An empty scope means "nothing", never "everything".
 *   3. An inactive user is refused, whatever their cookie says.
 */
import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { documents, rolePermissions, shopMemberships, users } from '@/db/schema'
import { auth } from './auth'
import type { Permission, RoleCode } from '@/lib/permissions'
import { PERMISSIONS } from '@/lib/permissions'

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'INACTIVE',
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export type Actor = {
  id: string
  name: string
  email: string
  roleCode: RoleCode
  isActive: boolean
  mustChangePassword: boolean
  permissions: Set<Permission>
  /** 'all' for admins, otherwise the shops this user may read. */
  readScope: 'all' | string[]
  /** Shops this user may approve for. */
  approveScope: 'all' | string[]
  /** Shops this user may upload into. */
  uploadScope: 'all' | string[]
}

/**
 * Resolves the current user once per request.
 * `cache` means many components can call this without extra database reads.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) return null

  const row = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: {
      id: true,
      name: true,
      email: true,
      roleCode: true,
      isActive: true,
      mustChangePassword: true,
    },
  })
  if (!row || !row.isActive) return null

  const roleCode = row.roleCode as RoleCode

  // super_admin is granted everything IN CODE, so the editable grid can never
  // lock the owner out of their own system.
  let permissions: Set<Permission>
  if (roleCode === 'super_admin') {
    permissions = new Set(PERMISSIONS)
  } else {
    const grants = await db
      .select({ code: rolePermissions.permissionCode })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleCode, roleCode))
    const known = new Set<string>(PERMISSIONS)
    permissions = new Set(
      grants.map((g) => g.code).filter((c): c is Permission => known.has(c)),
    )
  }

  const seesEveryShop = permissions.has('shop.view_all')
  let readScope: 'all' | string[] = 'all'
  let approveScope: 'all' | string[] = 'all'
  let uploadScope: 'all' | string[] = 'all'

  if (!seesEveryShop) {
    const memberships = await db
      .select({ shopId: shopMemberships.shopId, kind: shopMemberships.kind })
      .from(shopMemberships)
      .where(eq(shopMemberships.userId, row.id))

    readScope = [...new Set(memberships.map((m) => m.shopId))]
    approveScope = [
      ...new Set(memberships.filter((m) => m.kind === 'approver').map((m) => m.shopId)),
    ]
    uploadScope = [
      ...new Set(memberships.filter((m) => m.kind === 'member').map((m) => m.shopId)),
    ]
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    roleCode,
    isActive: row.isActive,
    mustChangePassword: row.mustChangePassword,
    permissions,
    readScope,
    approveScope,
    uploadScope,
  }
})

/** Throws unless somebody is signed in and active. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor()
  if (!actor) throw new AuthError('You are not signed in.', 'UNAUTHENTICATED')
  return actor
}

/** Throws unless the signed-in user holds this permission. */
export async function requirePermission(permission: Permission): Promise<Actor> {
  const actor = await requireActor()
  if (!actor.permissions.has(permission)) {
    throw new AuthError('You do not have permission to do that.', 'FORBIDDEN')
  }
  return actor
}

export function can(actor: Actor | null, permission: Permission): boolean {
  return actor?.permissions.has(permission) ?? false
}

export type ScopePurpose = 'read' | 'approve' | 'upload'

export function scopeFor(actor: Actor, purpose: ScopePurpose): 'all' | string[] {
  if (purpose === 'approve') return actor.approveScope
  if (purpose === 'upload') return actor.uploadScope
  return actor.readScope
}

/** True when this actor may act on this shop for this purpose. */
export function shopInScope(actor: Actor, shopId: string, purpose: ScopePurpose): boolean {
  const scope = scopeFor(actor, purpose)
  return scope === 'all' || scope.includes(shopId)
}

export function assertShopInScope(actor: Actor, shopId: string, purpose: ScopePurpose): void {
  if (!shopInScope(actor, shopId, purpose)) {
    throw new AuthError('That shop is not available to you.', 'FORBIDDEN')
  }
}

/**
 * The ONLY way to load a single document for an action.
 *
 * Checks the permission, loads the row, and checks the shop is in scope — so a user
 * cannot reach another shop's document by guessing its id. Returns NOT_FOUND rather
 * than FORBIDDEN for an out-of-scope shop, so ids cannot be probed.
 */
export async function requireDocument(
  documentId: string,
  permission: Permission,
  purpose: ScopePurpose = 'read',
) {
  const actor = await requirePermission(permission)
  const doc = await db.query.documents.findFirst({ where: eq(documents.id, documentId) })
  if (!doc) throw new AuthError('That document does not exist.', 'NOT_FOUND')
  if (!shopInScope(actor, doc.shopId, purpose)) {
    throw new AuthError('That document does not exist.', 'NOT_FOUND')
  }
  return { actor, doc }
}

/**
 * Turns a scope into a Drizzle condition. Callers MUST pass a scope — the type makes
 * forgetting it a compile error.
 */
export function scopeCondition(scope: 'all' | string[]) {
  if (scope === 'all') return undefined
  if (scope.length === 0) {
    // An empty scope means nothing, never everything.
    return inArray(documents.shopId, ['00000000-0000-0000-0000-000000000000'])
  }
  return inArray(documents.shopId, scope)
}

/** Combines a scope with other conditions, dropping undefined ones. */
export function withScope(scope: 'all' | string[], ...conditions: (ReturnType<typeof eq> | undefined)[]) {
  const all = [scopeCondition(scope), ...conditions].filter(Boolean)
  if (all.length === 0) return undefined
  if (all.length === 1) return all[0]
  return and(...(all as NonNullable<typeof all[number]>[]))
}
