/**
 * End-to-end smoke test of the upload -> storage -> OCR path, without a browser.
 *
 * It exercises the real StorageService, the real document row, and the real OCR
 * pipeline. With no Gemini key configured it is expected to end in `failed` with
 * reason `not_configured` — which still proves every step around Gemini works.
 *
 * Usage: npx tsx scripts/smoke-upload.ts
 */
import '../src/lib/load-env'
import { randomUUID } from 'node:crypto'
import { createHash } from 'node:crypto'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { desc, eq } from 'drizzle-orm'
import * as schema from '../src/db/schema'

/** A tiny but valid 8x8 PNG, so we are not shipping a real client document. */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAJUlEQVR4nGP8//8/AzGAiShVowZS' +
  'x0BGRkYGBgYGBgYGBgYGAEC5AwGvOxEAAAAAAElFTkSuQmCC'

async function main() {
  const url = process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL
  if (!url) throw new Error('Set DATABASE_URL in .env.local')
  const client = postgres(url, { max: 1 })
  const db = drizzle(client, { schema })

  const shop = await db.select().from(schema.shops).limit(1)
  const user = await db.select().from(schema.users).limit(1)
  if (shop.length === 0 || user.length === 0) {
    console.error('Need at least one shop and one user. Run the seed and create-admin first.')
    process.exit(1)
  }

  const bytes = Buffer.from(PNG_BASE64, 'base64')
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const documentId = randomUUID()
  const storageKey = `shops/${shop[0].id}/docs/${documentId}/original.png`

  // Write through the real storage driver.
  const { storage } = await import('../src/lib/storage')
  await storage().put(storageKey, new Uint8Array(bytes), 'image/png')
  const head = await storage().head(storageKey)
  console.log('1. storage write     :', head ? `ok, ${head.size} bytes` : 'FAILED')

  const readUrl = await storage().createSignedReadUrl(storageKey, 60)
  console.log('2. signed read url   :', readUrl ? 'ok' : 'FAILED')

  await db.insert(schema.documents).values({
    id: documentId,
    shopId: shop[0].id,
    documentTypeCode: 'delivery_chalan',
    status: 'processing',
    originalFilename: 'smoke-test.png',
    mimeType: 'image/png',
    fileSizeBytes: bytes.byteLength,
    sha256,
    storageKey,
    uploadedByUserId: user[0].id,
    ocrAttempts: 1,
    ocrStartedAt: new Date(),
  })
  console.log('3. document row      : ok')

  const { runOcr } = await import('../src/server/ocr/pipeline')
  await runOcr(documentId, 1)

  const after = await db.query.documents.findFirst({
    where: eq(schema.documents.id, documentId),
  })
  console.log('4. after runOcr      :', after?.status, after?.processingError ?? '')

  const events = await db
    .select()
    .from(schema.documentEvents)
    .where(eq(schema.documentEvents.documentId, documentId))
    .orderBy(desc(schema.documentEvents.id))
  console.log('5. events written    :', events.map((e) => e.eventType).join(' -> ') || 'none')

  // Clean up so the dashboard is not polluted by the smoke test.
  await db.delete(schema.documents).where(eq(schema.documents.id, documentId))
  await storage().delete(storageKey)
  console.log('6. cleaned up        : ok')

  const verdict =
    after?.status === 'draft'
      ? 'PASS — Gemini answered and the document is ready to check.'
      : after?.processingError === 'not_configured'
        ? 'PASS (no Gemini key) — every step except the Gemini call works.'
        : `CHECK — ended as ${after?.status} / ${after?.processingError}`
  console.log('\n' + verdict)

  await client.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
