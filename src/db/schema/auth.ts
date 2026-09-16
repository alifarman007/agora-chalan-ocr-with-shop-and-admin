/**
 * Better Auth tables, in OUR Postgres.
 *
 * The TypeScript property names must match what Better Auth expects (camelCase);
 * the database columns are snake_case. Do NOT move these into a schema called
 * "auth" — Supabase already owns a managed schema with that name.
 */
import { boolean, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { roles } from './rbac'

export const users = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

    // ── our additions ──────────────────────────────────────────────────────
    roleCode: text('role_code')
      .notNull()
      .default('shop_user')
      .references(() => roles.code, { onDelete: 'restrict' }),
    isActive: boolean('is_active').notNull().default(true),
    phone: text('phone'),
    mustChangePassword: boolean('must_change_password').notNull().default(true),
    createdByUserId: text('created_by_user_id'),
  },
  (t) => [
    uniqueIndex('user_email_lower_uq').on(sql`lower(${t.email})`),
    index('user_role_idx').on(t.roleCode),
    index('user_active_idx').on(t.isActive),
  ],
)

export const sessions = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('session_token_uq').on(t.token),
    index('session_user_idx').on(t.userId),
    index('session_expires_idx').on(t.expiresAt),
  ],
)

export const accounts = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('account_user_idx').on(t.userId),
    uniqueIndex('account_provider_uq').on(t.providerId, t.accountId),
  ],
)

export const verifications = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('verification_identifier_idx').on(t.identifier),
    index('verification_expires_idx').on(t.expiresAt),
  ],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
