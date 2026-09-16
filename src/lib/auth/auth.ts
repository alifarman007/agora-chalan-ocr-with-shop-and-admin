/**
 * Better Auth, backed by OUR Postgres tables.
 *
 * Deliberately NOT Supabase Auth: users and sessions must travel in a plain pg_dump
 * so the app can move to a self-hosted Postgres with an env-var change.
 */
import 'server-only'
import { betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { db } from '@/db'
import { accounts, sessions, users, verifications } from '@/db/schema'
import { appUrl, env } from '@/lib/env'

export const auth = betterAuth({
  appName: 'Agora Dashboard',
  secret: env().BETTER_AUTH_SECRET,
  baseURL: appUrl(),

  database: drizzleAdapter(db, {
    provider: 'pg',
    // Explicit mapping: our exports are plural, the tables are singular.
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),

  emailAndPassword: {
    enabled: true,
    // No public sign-up. An admin creates every account.
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once a day
    cookieCache: {
      // Cuts a database read on every navigation.
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  user: {
    additionalFields: {
      roleCode: { type: 'string', required: false, input: false },
      isActive: { type: 'boolean', required: false, input: false },
      phone: { type: 'string', required: false, input: false },
      mustChangePassword: { type: 'boolean', required: false, input: false },
      createdByUserId: { type: 'string', required: false, input: false },
    },
  },

  // nextCookies() MUST be last so Server Actions can set cookies.
  plugins: [nextCookies()],
})

export type Auth = typeof auth
