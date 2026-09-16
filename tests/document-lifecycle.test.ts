/**
 * Integration tests against a real Postgres.
 *
 * These cover the rules that protect money and accountability: a document cannot be
 * approved twice, two approvers racing produce exactly one decision, a stale edit is
 * refused, and nobody approves their own submission. Pure unit tests cannot prove any
 * of that, because the guarantees come from the conditional UPDATEs themselves.
 *
 * Skipped automatically when DATABASE_URL is not set.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/db/schema'

const url = process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL
const describeDb = url ? describe : describe.skip

describeDb('document lifecycle', () => {
  const client = postgres(url!, { max: 1 })
  const db = drizzle(client, { schema })

  let shopId: string
  let submitterId: string
  let approverId: string

  beforeAll(async () => {
    const shop = await db
      .insert(schema.shops)
      .values({ code: 'TEST-' + randomUUID().slice(0, 8).toUpperCase(), name: 'Test Shop' })
      .returning({ id: schema.shops.id })
    shopId = shop[0].id

    const mk = async (name: string, role: string) => {
      const id = randomUUID()
      await db.insert(schema.users).values({
        id,
        name,
        email: id + '@test.local',
        roleCode: role,
      })
      return id
    }
    submitterId = await mk('Test Submitter', 'shop_user')
    approverId = await mk('Test Approver', 'approver')
  })

  afterAll(async () => {
    await db.delete(schema.documents).where(eq(schema.documents.shopId, shopId))
    await db.delete(schema.shopMemberships).where(eq(schema.shopMemberships.shopId, shopId))
    await db.delete(schema.shops).where(eq(schema.shops.id, shopId))
    for (const id of [submitterId, approverId]) {
      await db.delete(schema.users).where(eq(schema.users.id, id))
    }
    await client.end()
  })

  async function makeDocument(status: string, extra: Record<string, unknown> = {}) {
    const id = randomUUID()
    await db.insert(schema.documents).values({
      id,
      shopId,
      documentTypeCode: 'delivery_chalan',
      status,
      originalFilename: 'test.png',
      mimeType: 'image/png',
      fileSizeBytes: 100,
      sha256: randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, ''),
      storageKey: 'shops/' + shopId + '/docs/' + id + '/original.png',
      uploadedByUserId: submitterId,
      ...extra,
    })
    return id
  }

  /** The exact conditional UPDATE the approve action runs. */
  async function approve(documentId: string, actorId: string, blockSelf = true) {
    const rows = await db
      .update(schema.documents)
      .set({ status: 'approved', reviewedByUserId: actorId, reviewedAt: new Date() })
      .where(
        and(
          eq(schema.documents.id, documentId),
          eq(schema.documents.status, 'pending_approval'),
          blockSelf
            ? sql`${schema.documents.submittedByUserId} is distinct from ${actorId}`
            : undefined,
        ),
      )
      .returning({ id: schema.documents.id })
    return rows.length
  }

  it('approves a pending document exactly once', async () => {
    const id = await makeDocument('pending_approval', {
      submittedByUserId: submitterId,
      submittedAt: new Date(),
      submissionCount: 1,
    })
    expect(await approve(id, approverId)).toBe(1)
    // A second attempt matches nothing, because the status already moved.
    expect(await approve(id, approverId)).toBe(0)
  })

  it('lets only one of two approvers racing win', async () => {
    const id = await makeDocument('pending_approval', {
      submittedByUserId: submitterId,
      submittedAt: new Date(),
      submissionCount: 1,
    })
    const other = randomUUID()
    await db.insert(schema.users).values({
      id: other,
      name: 'Second Approver',
      email: other + '@test.local',
      roleCode: 'approver',
    })

    const results = await Promise.all([approve(id, approverId), approve(id, other)])
    expect(results.filter((n) => n === 1)).toHaveLength(1)
    expect(results.filter((n) => n === 0)).toHaveLength(1)

    await db.delete(schema.users).where(eq(schema.users.id, other))
  })

  it('refuses to let the submitter approve their own document', async () => {
    const id = await makeDocument('pending_approval', {
      submittedByUserId: submitterId,
      submittedAt: new Date(),
      submissionCount: 1,
    })
    // The rule is enforced in SQL, not only in TypeScript, so a race cannot slip past.
    expect(await approve(id, submitterId)).toBe(0)
    // Somebody else still can.
    expect(await approve(id, approverId)).toBe(1)
  })

  it('allows self-approval when the setting is turned off', async () => {
    const id = await makeDocument('pending_approval', {
      submittedByUserId: submitterId,
      submittedAt: new Date(),
      submissionCount: 1,
    })
    expect(await approve(id, submitterId, false)).toBe(1)
  })

  it('refuses a stale edit', async () => {
    const id = await makeDocument('draft', { revision: 3 })
    const save = (expectedRevision: number) =>
      db
        .update(schema.documents)
        .set({ editedResult: { marker: expectedRevision } as never, revision: sql`revision + 1` })
        .where(
          and(
            eq(schema.documents.id, id),
            eq(schema.documents.revision, expectedRevision),
            sql`${schema.documents.status} in ('draft','rejected')`,
          ),
        )
        .returning({ revision: schema.documents.revision })

    const first = await save(3)
    expect(first).toHaveLength(1)
    expect(first[0].revision).toBe(4)
    // A second writer still holding revision 3 is refused.
    expect(await save(3)).toHaveLength(0)
  })

  it('cannot approve a document that is not pending', async () => {
    const id = await makeDocument('draft')
    expect(await approve(id, approverId)).toBe(0)
  })

  it('stops an old OCR attempt overwriting a newer one', async () => {
    const id = await makeDocument('processing', { ocrAttempts: 2, ocrStartedAt: new Date() })
    const finish = (attempt: number) =>
      db
        .update(schema.documents)
        .set({ status: 'draft', rawOcrText: 'from attempt ' + attempt })
        .where(
          and(
            eq(schema.documents.id, id),
            eq(schema.documents.status, 'processing'),
            eq(schema.documents.ocrAttempts, attempt),
          ),
        )
        .returning({ id: schema.documents.id })

    // Attempt 1 is stale: a retry already bumped the counter to 2.
    expect(await finish(1)).toHaveLength(0)
    expect(await finish(2)).toHaveLength(1)
  })

  it('blocks the same file being registered twice in one shop', async () => {
    const sha = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
    await makeDocument('uploaded', { sha256: sha })
    await expect(makeDocument('uploaded', { sha256: sha })).rejects.toThrow()
  })

  it('refuses an invalid status at the database level', async () => {
    await expect(makeDocument('nonsense')).rejects.toThrow()
  })
})
