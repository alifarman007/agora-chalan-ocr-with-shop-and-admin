/**
 * The ONE place that touches the database.
 *
 * Nothing else in the app may open a connection, and nothing anywhere may use
 * supabase-js or the Supabase Data API for data. Switching to a self-hosted
 * Postgres must be an env-var change only.
 */
import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { env } from '@/lib/env'

declare global {
  var __agoraSql: ReturnType<typeof postgres> | undefined
}

function client() {
  if (!globalThis.__agoraSql) {
    globalThis.__agoraSql = postgres(env().DATABASE_URL, {
      // Supabase's transaction pooler (port 6543) does not support prepared
      // statements. This is the single most common cause of mystery errors.
      prepare: false,
      max: 5,
      idle_timeout: 20,
    })
  }
  return globalThis.__agoraSql
}

export const db = drizzle(client(), { schema })
export { schema }
export type Db = typeof db
