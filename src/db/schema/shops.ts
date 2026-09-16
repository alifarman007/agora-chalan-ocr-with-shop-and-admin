/**
 * Shops (branches) and who may see or approve for them.
 *
 * One membership table answers both questions:
 *   kind = 'member'   -> may see, and (with the permission) upload/edit/submit here
 *   kind = 'approver' -> may approve/reject here
 * A person can be a member of one shop and an approver of another.
 *
 * Admins have NO rows here. They get the `shop.view_all` permission instead.
 */
import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth'

export const shops = pgTable(
  'shop',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Short human code, e.g. DHK-GUL-01. Immutable after creation. */
    code: text('code').notNull(),
    name: text('name').notNull(),
    address: text('address'),
    phone: text('phone'),
    /** Shops are never deleted, only deactivated, so document rows keep a valid FK. */
    isActive: boolean('is_active').notNull().default(true),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('shop_code_uq').on(t.code), index('shop_active_idx').on(t.isActive)],
)

export const shopMemberships = pgTable(
  'shop_membership',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    /** 'member' | 'approver' */
    kind: text('kind').notNull(),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.shopId, t.kind] }),
    index('membership_shop_kind_idx').on(t.shopId, t.kind),
    index('membership_user_idx').on(t.userId),
  ],
)

export type Shop = typeof shops.$inferSelect
export type NewShop = typeof shops.$inferInsert
export type ShopMembership = typeof shopMemberships.$inferSelect
export type MembershipKind = 'member' | 'approver'
