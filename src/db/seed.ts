/**
 * Seeds the fixed reference data: roles, the default permission grid, document types
 * and the Master Control defaults. Safe to run repeatedly.
 *
 * Run with: npm run db:seed
 */
import '../lib/load-env'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import * as schema from './schema'
import { DEFAULT_ROLE_PERMISSIONS, ROLE_CODES, ROLE_META } from '../lib/permissions'
import { SETTING_KEYS, defaultSettings } from '../lib/settings'

async function main() {
  const url = process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL
  if (!url) throw new Error('Set DATABASE_URL in .env.local')
  const client = postgres(url, { max: 1 })
  const db = drizzle(client, { schema })

  console.log('Seeding roles...')
  for (const code of ROLE_CODES) {
    const meta = ROLE_META[code]
    await db
      .insert(schema.roles)
      .values({ code, name: meta.name, description: meta.description, rank: meta.rank })
      .onConflictDoUpdate({
        target: schema.roles.code,
        set: { name: meta.name, description: meta.description, rank: meta.rank },
      })
  }

  console.log('Seeding the default permission grid...')
  for (const code of ROLE_CODES) {
    for (const permission of DEFAULT_ROLE_PERMISSIONS[code]) {
      await db
        .insert(schema.rolePermissions)
        .values({ roleCode: code, permissionCode: permission })
        .onConflictDoNothing()
    }
  }

  console.log('Seeding document types...')
  const types = [
    {
      code: 'delivery_chalan',
      name: 'Delivery Chalan',
      hasStructuredExtraction: true,
      sortOrder: 10,
    },
    { code: 'receipt', name: 'Receipt', hasStructuredExtraction: false, sortOrder: 20 },
    { code: 'other', name: 'Other document', hasStructuredExtraction: false, sortOrder: 30 },
  ]
  for (const t of types) {
    await db
      .insert(schema.documentTypes)
      .values(t)
      .onConflictDoUpdate({
        target: schema.documentTypes.code,
        set: { name: t.name, hasStructuredExtraction: t.hasStructuredExtraction },
      })
  }

  console.log('Seeding Master Control defaults...')
  const defaults = defaultSettings() as Record<string, unknown>
  for (const key of SETTING_KEYS) {
    await db
      .insert(schema.appSettings)
      // JSON null must be stored as the jsonb value `null`, not as SQL NULL.
      .values({ key, value: sql`${JSON.stringify(defaults[key])}::jsonb` as never })
      .onConflictDoNothing() // never overwrite what an admin has changed
  }

  const counts = await db.execute(sql`
    select
      (select count(*) from "role") as roles,
      (select count(*) from "role_permission") as grants,
      (select count(*) from "document_type") as types,
      (select count(*) from "app_setting") as settings
  `)
  console.log('Done:', counts[0])
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
