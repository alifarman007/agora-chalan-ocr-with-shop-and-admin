/**
 * The ONE place that touches the database.
 *
 * Nothing else in the app may open a connection, and nothing anywhere may use
 * supabase-js or the Supabase Data API for data. Switching to a self-hosted
 * Postgres must be an env-var change only.
 *
 * The connection is built LAZILY, on the first query. Next.js imports these modules
 * while collecting page data at build time, and connecting eagerly would make a build
 * fail with a confusing error whenever DATABASE_URL happens to be absent. A missing
 * variable should surface as a clear message on the first request instead.
 */
import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { env } from '@/lib/env'

declare global {
  var __agoraSql: ReturnType<typeof postgres> | undefined
  var __agoraDb: ReturnType<typeof drizzle<typeof schema>> | undefined
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

function connection() {
  if (!globalThis.__agoraDb) {
    globalThis.__agoraDb = drizzle(client(), { schema })
  }
  return globalThis.__agoraDb
}

export type Db = ReturnType<typeof connection>

/**
 * Looks and behaves exactly like a Drizzle instance, but does not connect until the
 * first property is read.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, property, receiver) {
    return Reflect.get(connection(), property, receiver)
  },
  has(_target, property) {
    return Reflect.has(connection(), property)
  },
})

export { schema }
