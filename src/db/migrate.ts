/**
 * Apply migrations. Run with: npm run db:migrate
 * Uses DATABASE_URL_MIGRATE (session connection) when set.
 */
import '../lib/load-env'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

async function main() {
  const url = process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL
  if (!url) throw new Error('Set DATABASE_URL_MIGRATE (or DATABASE_URL) in .env.local')

  const sql = postgres(url, { max: 1 })
  const db = drizzle(sql)
  console.log('Applying migrations...')
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('Migrations applied.')
  await sql.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
