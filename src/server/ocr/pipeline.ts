/**
 * The OCR pipeline, moved from the browser to the server.
 *
 * This is the direct port of StructuredEditorTab.processDocument() from the approved
 * app (agoraOCR @ b54ac32). The ORDER of the steps and the assignment of ocr_usage are
 * approved behaviour and must not change:
 *
 *     performOCR(base64, mime, model)      -> raw text
 *     structureDeliveryChalan(text, model) -> structured JSON
 *     result.ocr_usage = ocrResult.usageMetadata
 *
 * What is new here is only plumbing: the bytes come from storage instead of a browser
 * FileReader, the result is written to Postgres, and a thumbnail is generated.
 */
import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { documentEvents, documents, documentTypes } from '@/db/schema'
import { storage, thumbnailKey } from '@/lib/storage'
import { getSettings } from '@/server/settings'
import { performOCR } from './geminiService'
import { structureDeliveryChalan } from './structureService'
import { MissingApiKeyError } from './geminiClient'
import { calculateCost } from '@/lib/ocr/costCalculator'
import type { ModelType } from '@/types/ocr'
import type { DeliveryChalanDocument } from '@/types/delivery-chalan'

/** Errors the user may see. The real cause always goes to the log, never the screen. */
export type OcrFailure =
  | 'not_configured'
  | 'file_missing'
  | 'file_too_large'
  | 'checksum_mismatch'
  | 'unsupported_type'
  | 'model_error'
  | 'bad_json'
  | 'unknown'

/** Gemini caps a whole inline request at 20 MB, and base64 adds about a third. */
const MAX_INLINE_BYTES = 14 * 1024 * 1024

function classify(error: unknown): OcrFailure {
  if (error instanceof MissingApiKeyError) return 'not_configured'
  const message = error instanceof Error ? error.message : String(error)
  if (/JSON|Unexpected token/i.test(message)) return 'bad_json'
  if (/empty response|No text extraction/i.test(message)) return 'model_error'
  return 'unknown'
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const { createHash } = await import('node:crypto')
  return createHash('sha256').update(bytes).digest('hex')
}

/** Best effort. A missing thumbnail is never an error. */
async function makeThumbnail(
  bytes: Uint8Array,
  mimeType: string,
  shopId: string,
  documentId: string,
  maxPx: number,
): Promise<string | null> {
  // PDFs are rendered in the browser (pdf.js is already loaded there for the preview).
  // Doing it on the server would add ~70 MB of native binaries to the function.
  if (!mimeType.startsWith('image/')) return null
  try {
    const sharp = (await import('sharp')).default
    const out = await sharp(Buffer.from(bytes))
      .rotate() // honour EXIF orientation
      .resize(maxPx, maxPx, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer()
    const key = thumbnailKey(shopId, documentId)
    await storage().put(key, new Uint8Array(out), 'image/webp')
    return key
  } catch (error) {
    console.error('[ocr] thumbnail failed', error)
    return null
  }
}

function priceFor(
  pricing: Record<string, { input_usd_per_1m: number; output_usd_per_1m: number; until?: string | null; then?: { input_usd_per_1m: number; output_usd_per_1m: number } | null }>,
  model: string,
) {
  const entry = pricing[model]
  if (!entry) return null
  if (entry.until && entry.then && new Date() > new Date(entry.until + 'T23:59:59Z')) {
    return entry.then
  }
  return { input_usd_per_1m: entry.input_usd_per_1m, output_usd_per_1m: entry.output_usd_per_1m }
}

/**
 * Runs one OCR attempt to completion and writes the outcome.
 * Never throws: every failure is recorded on the row so the user sees a retry button.
 */
export async function runOcr(documentId: string, attempt: number): Promise<void> {
  const started = Date.now()
  const settings = await getSettings()

  const doc = await db.query.documents.findFirst({ where: eq(documents.id, documentId) })
  if (!doc) {
    console.error('[ocr] document vanished', documentId)
    return
  }

  const type = await db.query.documentTypes.findFirst({
    where: eq(documentTypes.code, doc.documentTypeCode),
  })

  const model = (doc.processingModel ?? settings['ocr.default_model']) as ModelType

  const fail = async (reason: OcrFailure, detail: string) => {
    console.error('[ocr] ' + documentId + ' failed: ' + reason + ' — ' + detail)
    await db.transaction(async (tx) => {
      await tx
        .update(documents)
        .set({
          status: 'failed',
          processingError: reason,
          ocrFinishedAt: new Date(),
          updatedAt: new Date(),
          revision: sql`${documents.revision} + 1`,
        })
        .where(and(eq(documents.id, documentId), eq(documents.status, 'processing')))
      await tx.insert(documentEvents).values({
        documentId,
        eventType: 'ocr_failed',
        fromStatus: 'processing',
        toStatus: 'failed',
        details: { attempt, reason, detail, model, durationMs: Date.now() - started },
      })
    })
  }

  try {
    // ── 1. read the bytes from storage, and check them ─────────────────────
    const head = await storage().head(doc.storageKey)
    if (!head) return await fail('file_missing', 'no object at ' + doc.storageKey)

    const bytes = await storage().getBytes(doc.storageKey)
    if (bytes.byteLength > MAX_INLINE_BYTES) {
      return await fail('file_too_large', bytes.byteLength + ' bytes')
    }

    const actual = await sha256Hex(bytes)
    if (doc.sha256 && actual !== doc.sha256) {
      return await fail('checksum_mismatch', 'stored file does not match the declared hash')
    }

    const base64 = Buffer.from(bytes).toString('base64')

    // ── 2. Gemini call 1: OCR (approved logic, untouched) ──────────────────
    const ocrResult = await performOCR(base64, doc.mimeType, model)

    // Checkpoint the raw text straight away, so a failure in call 2 never has to
    // pay for call 1 again on the retry.
    await db
      .update(documents)
      .set({ rawOcrText: ocrResult.text, updatedAt: new Date() })
      .where(eq(documents.id, documentId))

    // ── 3. Gemini call 2: structuring, only for types that have it ─────────
    let structured: DeliveryChalanDocument | null = null
    if (type?.hasStructuredExtraction) {
      structured = await structureDeliveryChalan(ocrResult.text, model)
      // Approved behaviour: the OCR usage is attached to the structured document.
      structured.ocr_usage = ocrResult.usageMetadata
    }

    // ── 4. thumbnail (best effort) ─────────────────────────────────────────
    const thumb =
      doc.thumbnailKey ??
      (await makeThumbnail(
        bytes,
        doc.mimeType,
        doc.shopId,
        documentId,
        settings['display.thumbnail_max_px'],
      ))

    // ── 5. tokens and cost ─────────────────────────────────────────────────
    const inputTokens =
      (ocrResult.usageMetadata?.promptTokenCount ?? 0) +
      (structured?.structuring_usage?.promptTokenCount ?? 0)
    const outputTokens =
      (ocrResult.usageMetadata?.candidatesTokenCount ?? 0) +
      (structured?.structuring_usage?.candidatesTokenCount ?? 0)
    const thinkingTokens =
      ((ocrResult.usageMetadata as { thoughtsTokenCount?: number })?.thoughtsTokenCount ?? 0) +
      ((structured?.structuring_usage as { thoughtsTokenCount?: number })?.thoughtsTokenCount ?? 0)

    const rate = priceFor(settings['cost.pricing'], model)
    const costUsd = rate
      ? (inputTokens / 1_000_000) * rate.input_usd_per_1m +
        (outputTokens / 1_000_000) * rate.output_usd_per_1m
      : calculateCost(model, inputTokens, outputTokens).totalCost

    const confidence =
      typeof structured?.ai_confidence === 'number'
        ? Math.min(1, structured.ai_confidence > 1 ? structured.ai_confidence / 100 : structured.ai_confidence)
        : null

    // ── 6. one final write ─────────────────────────────────────────────────
    // The attempt guard means a stale attempt can never overwrite a newer one.
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(documents)
        .set({
          status: 'draft',
          rawOcrText: ocrResult.text,
          aiResult: structured ?? null,
          editedResult: structured ?? null,
          aiConfidence: confidence === null ? null : String(confidence),
          processingModel: model,
          inputTokens,
          outputTokens,
          thinkingTokens,
          costUsd: costUsd.toFixed(6),
          thumbnailKey: thumb,
          processingError: null,
          ocrFinishedAt: new Date(),
          updatedAt: new Date(),
          revision: sql`${documents.revision} + 1`,
        })
        .where(
          and(
            eq(documents.id, documentId),
            eq(documents.status, 'processing'),
            eq(documents.ocrAttempts, attempt),
          ),
        )
        .returning({ id: documents.id })

      if (updated.length === 0) {
        console.warn('[ocr] ' + documentId + ' attempt ' + attempt + ' superseded; discarding')
        return
      }

      await tx.insert(documentEvents).values({
        documentId,
        eventType: 'ocr_succeeded',
        fromStatus: 'processing',
        toStatus: 'draft',
        details: {
          attempt,
          model,
          inputTokens,
          outputTokens,
          thinkingTokens,
          costUsd: Number(costUsd.toFixed(6)),
          durationMs: Date.now() - started,
          structured: Boolean(structured),
          thumbnail: Boolean(thumb),
        },
      })
    })
  } catch (error) {
    // Matches the approved app's rule: never surface a raw API error.
    console.error('[ocr] unhandled', error)
    await fail(classify(error), error instanceof Error ? error.message : String(error))
  }
}

/**
 * Marks documents stuck in `processing` as failed.
 *
 * Vercel's Hobby plan only allows a DAILY cron, so this cannot rely on cron alone —
 * it is also called from the status poll and from list queries, which is what makes a
 * stuck job visible within seconds rather than a day.
 */
export async function reapStaleJobs(documentId?: string): Promise<number> {
  const settings = await getSettings()
  const minutes = settings['ocr.stale_after_minutes']
  const cutoff = new Date(Date.now() - minutes * 60_000)

  const stale = await db
    .update(documents)
    .set({
      status: 'failed',
      processingError: 'timed_out',
      ocrFinishedAt: new Date(),
      updatedAt: new Date(),
      revision: sql`${documents.revision} + 1`,
    })
    .where(
      and(
        eq(documents.status, 'processing'),
        sql`${documents.ocrStartedAt} < ${cutoff}`,
        documentId ? eq(documents.id, documentId) : undefined,
      ),
    )
    .returning({ id: documents.id, attempts: documents.ocrAttempts })

  for (const row of stale) {
    await db.insert(documentEvents).values({
      documentId: row.id,
      eventType: 'ocr_failed',
      fromStatus: 'processing',
      toStatus: 'failed',
      details: { attempt: row.attempts, reason: 'timed_out', timedOut: true },
    })
  }
  return stale.length
}
