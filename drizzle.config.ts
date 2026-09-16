import './src/lib/load-env'
import { defineConfig } from 'drizzle-kit'

/**
 * Migrations use the SESSION connection (Supabase port 5432), never the
 * transaction pooler — transaction pooling cannot run migrations.
 */
export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL ?? '',
  },
  casing: 'snake_case',
  verbose: true,
  strict: true,
})
