/**
 * Roles and the editable role -> permission grid.
 *
 * The permission VOCABULARY is fixed in code (src/lib/permissions.ts) so the UI can
 * never show a permission the server does not enforce. Only the MAPPING lives here,
 * so an admin can retune it from Master Control without a deploy.
 *
 * Rows for 'super_admin' are ignored at runtime — code grants it everything, so the
 * grid can never lock the owner out.
 */
import { integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const roles = pgTable('role', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  /** 100 super_admin, 80 admin, 60 approver, 40 shop_user, 20 viewer.
   *  A user may only assign a role ranked strictly below their own. */
  rank: integer('rank').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const rolePermissions = pgTable(
  'role_permission',
  {
    roleCode: text('role_code')
      .notNull()
      .references(() => roles.code, { onDelete: 'cascade' }),
    permissionCode: text('permission_code').notNull(),
    grantedByUserId: text('granted_by_user_id'),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.roleCode, t.permissionCode] })],
)

/** Raised in a migration so the DB itself rejects an unknown role code. */
export const ROLE_CODE_CHECK = sql`code in ('super_admin','admin','approver','shop_user','viewer')`

export type Role = typeof roles.$inferSelect
export type RolePermission = typeof rolePermissions.$inferSelect
