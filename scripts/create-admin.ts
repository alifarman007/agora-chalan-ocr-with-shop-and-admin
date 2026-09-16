/**
 * Creates (or promotes) the first Super Admin.
 *
 * Public sign-up is switched off, so the very first account has to be made here.
 * The password is hashed with Better Auth's OWN hashPassword, so the stored hash is
 * exactly what the sign-in route later verifies against — we are not inventing a
 * second password format.
 *
 * Usage:
 *   npm run create-admin -- --email you@agora.com.bd --name "Your Name" --password "secret123"
 *   npm run create-admin            (prompts are not used; it prints what it needs)
 */
import '../src/lib/load-env'
import { randomUUID } from 'node:crypto'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq, sql } from 'drizzle-orm'
import { hashPassword } from 'better-auth/crypto'
import * as schema from '../src/db/schema'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const email = (arg('email') ?? '').trim().toLowerCase()
  const name = arg('name') ?? 'Super Admin'
  const password = arg('password') ?? ''

  if (!email || !password) {
    console.error(
      'Usage: npm run create-admin -- --email you@agora.com.bd --name "Your Name" --password "at-least-8-chars"',
    )
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('The password must be at least 8 characters.')
    process.exit(1)
  }

  const url = process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL
  if (!url) throw new Error('Set DATABASE_URL in .env.local')

  const client = postgres(url, { max: 1 })
  const db = drizzle(client, { schema })

  const existing = await db
    .select({ id: schema.users.id, roleCode: schema.users.roleCode })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${email}`)
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(schema.users)
      .set({ roleCode: 'super_admin', isActive: true, updatedAt: new Date() })
      .where(eq(schema.users.id, existing[0].id))
    console.log(`Promoted the existing account ${email} to Super Admin.`)
    await client.end()
    return
  }

  const userId = randomUUID()
  const hashed = await hashPassword(password)

  await db.transaction(async (tx) => {
    await tx.insert(schema.users).values({
      id: userId,
      name,
      email,
      emailVerified: true,
      roleCode: 'super_admin',
      isActive: true,
      // The bootstrap admin chooses their own password here, so no forced change.
      mustChangePassword: false,
    })
    await tx.insert(schema.accounts).values({
      id: randomUUID(),
      accountId: userId,
      providerId: 'credential',
      userId,
      password: hashed,
    })
  })

  console.log('Created the Super Admin account.')
  console.log('  email: ' + email)
  console.log('  Sign in at http://localhost:3000/login')
  await client.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
