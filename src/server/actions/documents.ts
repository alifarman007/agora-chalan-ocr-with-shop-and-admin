'use server'

/**
 * Document actions.
 *
 * Every one of these starts with a permission check on the server. A hidden button is
 * never the control — Server Actions POST to the page route and bypass proxy.ts
 * matchers entirely.
 *
 * Every state change is ONE conditional UPDATE plus its event, in one transaction:
 *     UPDATE ... WHERE id = $1 AND status = $expected AND revision = $expected
 * Zero rows back means somebody got there first, and we answer honestly rather than
 * silently doing the wrong thing.
 */
import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { documentEvents, documents, documentTypes, shops } from '@/db/schema'
import {
  AuthError,
  assertShopInScope,
  requireDocument,
  requirePermission,
} from '@/lib/auth/session'
import { extensionForMime, originalKey, storage } from '@/lib/storage'
import { getSettings } from '@/server/settings'
import { reapStaleJobs } from '@/server/ocr/pipeline'
import type { DeliveryChalanDocument } from '@/types/delivery-chalan'

export type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string; current?: unknown }

function fail(error: unknown): { ok: false; error: string; code?: string } {
  if (error instanceof AuthError) return { ok: false, error: error.message, code: error.code }
  console.error('[action]', error)
  return { ok: false, error: 'Something went wrong. Please try again.' }
}

// ── 1. upload ───────────────────────────────────────────────────────────────

const createUploadUrlInput = z.object({
  shopId: z.string().uuid(),
  documentTypeCode: z.string().min(1),
  filename: z.string().min(1).max(300),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
})

/**
 * Mints a signed upload URL. Writes NOTHING to the database — an abandoned upload
 * leaves at most a harmless orphan object, never a half-made row.
 */
export async function createUploadUrl(
  raw: z.input<typeof createUploadUrlInput>,
): Promise<ActionResult<{ documentId: string; storageKey: string; uploadUrl: string; method: string; headers: Record<string, string> }>> {
  try {
    const input = createUploadUrlInput.parse(raw)
    const actor = await requirePermission('document.upload')
    assertShopInScope(actor, input.shopId, 'upload')

    const settings = await getSettings()
    const allowed = settings['upload.allowed_mime_types']
    if (!allowed.includes(input.mimeType)) {
      return { ok: false, error: 'That file type is not allowed. Allowed: ' + allowed.join(', ') }
    }
    if (input.sizeBytes > settings['upload.max_file_bytes']) {
      const mb = Math.round(settings['upload.max_file_bytes'] / 1024 / 1024)
      return { ok: false, error: 'That file is too large. The limit is ' + mb + ' MB.' }
    }

    const type = await db.query.documentTypes.findFirst({
      where: and(eq(documentTypes.code, input.documentTypeCode), eq(documentTypes.isActive, true)),
    })
    if (!type) return { ok: false, error: 'That document type is not available.' }

    const shop = await db.query.shops.findFirst({
      where: and(eq(shops.id, input.shopId), eq(shops.isActive, true)),
    })
    if (!shop) return { ok: false, error: 'That shop is not available.' }

    const ext = extensionForMime(input.mimeType)
    if (!ext) return { ok: false, error: 'That file type is not allowed.' }

    // The id is generated here so the storage key can embed it. The row is only
    // written once the bytes are really there (registerUpload).
    const documentId = crypto.randomUUID()
    const key = originalKey(input.shopId, documentId, ext)
    const signed = await storage().createSignedUploadUrl(key, input.mimeType, 600)

    return {
      ok: true,
      documentId,
      storageKey: key,
      uploadUrl: signed.url,
      method: signed.method,
      headers: signed.headers,
    }
  } catch (error) {
    return fail(error)
  }
}

const registerUploadInput = z.object({
  documentId: z.string().uuid(),
  shopId: z.string().uuid(),
  documentTypeCode: z.string().min(1),
  filename: z.string().min(1).max(300),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
})

/** Confirms the object landed, then writes the row. Safe to call twice. */
export async function registerUpload(
  raw: z.input<typeof registerUploadInput>,
): Promise<ActionResult<{ documentId: string; duplicate: boolean }>> {
  try {
    const input = registerUploadInput.parse(raw)
    const actor = await requirePermission('document.upload')
    assertShopInScope(actor, input.shopId, 'upload')

    const ext = extensionForMime(input.mimeType)
    if (!ext) return { ok: false, error: 'That file type is not allowed.' }

    // Re-derive the key on the server. A client-supplied key is never trusted.
    const key = originalKey(input.shopId, input.documentId, ext)
    const head = await storage().head(key)
    if (!head) return { ok: false, error: 'The upload did not finish. Please try again.' }

    const existing = await db.query.documents.findFirst({
      where: and(eq(documents.shopId, input.shopId), eq(documents.sha256, input.sha256)),
    })
    if (existing) {
      // Same file, same shop: hand back the original rather than starting a second
      // approval thread, and drop the duplicate object.
      if (existing.id !== input.documentId) await storage().delete(key)
      return { ok: true, documentId: existing.id, duplicate: true }
    }

    await db.transaction(async (tx) => {
      await tx.insert(documents).values({
        id: input.documentId,
        shopId: input.shopId,
        documentTypeCode: input.documentTypeCode,
        status: 'uploaded',
        originalFilename: input.filename,
        mimeType: input.mimeType,
        fileSizeBytes: input.sizeBytes,
        sha256: input.sha256,
        storageKey: key,
        uploadedByUserId: actor.id,
      })
      await tx.insert(documentEvents).values({
        documentId: input.documentId,
        eventType: 'uploaded',
        actorUserId: actor.id,
        toStatus: 'uploaded',
        details: {
          filename: input.filename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          sha256: input.sha256,
        },
      })
    })

    revalidatePath('/documents')
    return { ok: true, documentId: input.documentId, duplicate: false }
  } catch (error) {
    return fail(error)
  }
}

/** Saves a browser-rendered PDF thumbnail. Best effort: never fails the upload. */
export async function attachThumbnail(
  documentId: string,
  dataUrl: string,
): Promise<ActionResult> {
  try {
    const { actor, doc } = await requireDocument(documentId, 'document.upload', 'upload')
    if (doc.thumbnailKey) return { ok: true }
    const match = /^data:image\/(png|webp|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
    if (!match) return { ok: false, error: 'Bad thumbnail.' }
    const bytes = Buffer.from(match[2], 'base64')
    if (bytes.byteLength > 2 * 1024 * 1024) return { ok: false, error: 'Thumbnail too large.' }

    const { thumbnailKey } = await import('@/lib/storage')
    const key = thumbnailKey(doc.shopId, documentId)
    await storage().put(key, new Uint8Array(bytes), 'image/' + match[1])
    await db
      .update(documents)
      .set({ thumbnailKey: key, updatedAt: new Date() })
      .where(eq(documents.id, documentId))
    void actor
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

// ── 2. editing ──────────────────────────────────────────────────────────────

const saveDraftInput = z.object({
  documentId: z.string().uuid(),
  expectedRevision: z.number().int().min(0),
  editedResult: z.unknown(),
})

export async function saveDraft(
  raw: z.input<typeof saveDraftInput>,
): Promise<ActionResult<{ revision: number }>> {
  try {
    const input = saveDraftInput.parse(raw)
    const { actor, doc } = await requireDocument(input.documentId, 'document.edit')

    if (doc.status !== 'draft' && doc.status !== 'rejected') {
      return { ok: false, error: 'This document can no longer be edited.', code: 'WRONG_STATUS' }
    }

    const updated = await db
      .update(documents)
      .set({
        editedResult: input.editedResult as never,
        updatedAt: new Date(),
        revision: sql`${documents.revision} + 1`,
      })
      .where(
        and(
          eq(documents.id, input.documentId),
          eq(documents.revision, input.expectedRevision),
          sql`${documents.status} in ('draft','rejected')`,
        ),
      )
      .returning({ revision: documents.revision })

    if (updated.length === 0) {
      const current = await db.query.documents.findFirst({
        where: eq(documents.id, input.documentId),
        columns: { revision: true, status: true, editedResult: true },
      })
      return {
        ok: false,
        error: 'Someone else changed this document. Reload to see their version.',
        code: 'STALE',
        current,
      }
    }

    await db.insert(documentEvents).values({
      documentId: input.documentId,
      eventType: 'draft_saved',
      actorUserId: actor.id,
      fromStatus: doc.status,
      toStatus: doc.status,
      details: { revision: updated[0].revision },
    })

    return { ok: true, revision: updated[0].revision }
  } catch (error) {
    return fail(error)
  }
}

// ── 3. submit and resubmit ──────────────────────────────────────────────────

const submitInput = z.object({
  documentId: z.string().uuid(),
  expectedRevision: z.number().int().min(0),
  document: z.unknown(),
  corrections_made: z.boolean().optional(),
  correction_count: z.number().int().min(0).optional(),
  requestId: z.string().uuid().optional(),
})

/**
 * Submit, and resubmit after a rejection — deliberately the same code path, because
 * they differ only in which status they start from.
 * Returns the approved app's SubmitChalanResponse shape.
 */
export async function submitChalan(
  raw: z.input<typeof submitInput>,
): Promise<ActionResult<{ id: string; status: string; message?: string }>> {
  try {
    const input = submitInput.parse(raw)
    const { actor, doc } = await requireDocument(input.documentId, 'document.submit')

    if (doc.status === 'pending_approval') {
      // Idempotent replay of a double click.
      if (doc.submittedByUserId === actor.id) {
        return { ok: true, id: doc.id, status: doc.status, message: 'Already submitted.' }
      }
      return { ok: false, error: 'This document is already waiting for approval.' }
    }
    if (doc.status !== 'draft' && doc.status !== 'rejected') {
      return { ok: false, error: 'This document cannot be submitted from its current state.' }
    }

    const isResubmit = doc.status === 'rejected'
    const now = new Date()

    const updated = await db
      .update(documents)
      .set({
        status: 'pending_approval',
        editedResult: (input.document ?? doc.editedResult) as never,
        correctionsMade: input.corrections_made ? 1 : 0,
        correctionCount: input.correction_count ?? null,
        submittedByUserId: actor.id,
        submittedAt: now,
        submissionCount: sql`${documents.submissionCount} + 1`,
        updatedAt: now,
        revision: sql`${documents.revision} + 1`,
      })
      .where(
        and(
          eq(documents.id, input.documentId),
          eq(documents.revision, input.expectedRevision),
          eq(documents.status, doc.status),
        ),
      )
      .returning({ id: documents.id, submissionCount: documents.submissionCount })

    if (updated.length === 0) {
      return {
        ok: false,
        error: 'Someone else changed this document. Reload and try again.',
        code: 'STALE',
      }
    }

    await db.insert(documentEvents).values({
      documentId: input.documentId,
      eventType: isResubmit ? 'resubmitted' : 'submitted',
      actorUserId: actor.id,
      fromStatus: doc.status,
      toStatus: 'pending_approval',
      requestId: input.requestId ?? null,
      details: {
        // A full snapshot: this is what makes the history reconstructible without a
        // separate versions table.
        snapshot: input.document ?? doc.editedResult,
        correctionCount: input.correction_count ?? null,
        submissionCount: updated[0].submissionCount,
      },
    })

    revalidatePath('/documents')
    revalidatePath('/approvals')
    revalidatePath('/documents/' + input.documentId)
    return { ok: true, id: input.documentId, status: 'pending_approval' }
  } catch (error) {
    return fail(error)
  }
}

export async function resubmitChalan(raw: z.input<typeof submitInput>) {
  return submitChalan(raw)
}

// ── 4. approve and reject ───────────────────────────────────────────────────

const decisionInput = z.object({
  documentId: z.string().uuid(),
  note: z.string().max(2000).optional(),
  requestId: z.string().uuid().optional(),
})

async function decide(
  raw: z.input<typeof decisionInput>,
  decision: 'approved' | 'rejected',
): Promise<ActionResult<{ id: string; status: string; message?: string }>> {
  const input = decisionInput.parse(raw)
  const { actor, doc } = await requireDocument(input.documentId, 'document.approve', 'approve')
  const settings = await getSettings()

  if (doc.status === decision) {
    if (doc.reviewedByUserId === actor.id) {
      return { ok: true, id: doc.id, status: decision, message: 'Already done.' }
    }
  }
  if (doc.status !== 'pending_approval') {
    return {
      ok: false,
      error:
        doc.status === 'approved' || doc.status === 'rejected'
          ? 'This document was already ' + doc.status + '.'
          : 'This document is not waiting for approval.',
      code: 'WRONG_STATUS',
    }
  }

  if (decision === 'rejected' && settings['approval.require_note_on_reject'] && !input.note?.trim()) {
    return { ok: false, error: 'Please write a note explaining the rejection.' }
  }
  if (decision === 'approved' && settings['approval.require_note_on_approve'] && !input.note?.trim()) {
    return { ok: false, error: 'Please write a note.' }
  }

  const blockSelf = settings['approval.disallow_self_approval']
  if (blockSelf && doc.submittedByUserId === actor.id) {
    return {
      ok: false,
      error: 'You submitted this document. Another approver has to review it.',
      code: 'SELF_APPROVAL',
    }
  }

  const now = new Date()
  const updated = await db
    .update(documents)
    .set({
      status: decision,
      reviewedByUserId: actor.id,
      reviewedAt: now,
      reviewNote: input.note ?? null,
      updatedAt: now,
      revision: sql`${documents.revision} + 1`,
    })
    .where(
      and(
        eq(documents.id, input.documentId),
        eq(documents.status, 'pending_approval'),
        // Enforced in SQL too, so a race cannot slip past the check above.
        blockSelf ? sql`${documents.submittedByUserId} is distinct from ${actor.id}` : undefined,
      ),
    )
    .returning({ id: documents.id })

  if (updated.length === 0) {
    const current = await db.query.documents.findFirst({
      where: eq(documents.id, input.documentId),
      columns: { status: true, reviewedByUserId: true, reviewedAt: true },
    })
    return {
      ok: false,
      error: 'Someone else already decided this document.',
      code: 'CONFLICT',
      current,
    }
  }

  await db.insert(documentEvents).values({
    documentId: input.documentId,
    eventType: decision,
    actorUserId: actor.id,
    fromStatus: 'pending_approval',
    toStatus: decision,
    note: input.note ?? null,
    requestId: input.requestId ?? null,
    details: { note: input.note ?? null },
  })

  revalidatePath('/approvals')
  revalidatePath('/approved')
  revalidatePath('/documents/' + input.documentId)
  return { ok: true, id: input.documentId, status: decision }
}

export async function approveDocument(raw: z.input<typeof decisionInput>) {
  try {
    return await decide(raw, 'approved')
  } catch (error) {
    return fail(error)
  }
}

export async function rejectDocument(raw: z.input<typeof decisionInput>) {
  try {
    return await decide(raw, 'rejected')
  } catch (error) {
    return fail(error)
  }
}

// ── 5. delete an unsubmitted draft ──────────────────────────────────────────

export async function deleteDraft(documentId: string): Promise<ActionResult> {
  try {
    const { actor, doc } = await requireDocument(documentId, 'document.delete_draft')

    // Anything ever submitted keeps its approval history forever.
    if (doc.submissionCount > 0) {
      return { ok: false, error: 'This document has been submitted and cannot be deleted.' }
    }
    if (!['uploaded', 'failed', 'draft'].includes(doc.status)) {
      return { ok: false, error: 'This document cannot be deleted.' }
    }
    const isOwner = doc.uploadedByUserId === actor.id
    const isAdmin = actor.permissions.has('shop.view_all')
    if (!isOwner && !isAdmin) {
      return { ok: false, error: 'Only the person who uploaded this, or an admin, can delete it.' }
    }

    await db.delete(documents).where(eq(documents.id, documentId))
    await storage().delete(doc.storageKey).catch(() => {})
    if (doc.thumbnailKey) await storage().delete(doc.thumbnailKey).catch(() => {})

    revalidatePath('/documents')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

// ── 6. reads ────────────────────────────────────────────────────────────────

export async function getDocumentDetail(documentId: string) {
  const { actor, doc } = await requireDocument(documentId, 'document.view')
  await reapStaleJobs(documentId)

  const fresh = await db.query.documents.findFirst({ where: eq(documents.id, documentId) })
  if (!fresh) throw new AuthError('That document does not exist.', 'NOT_FOUND')

  const [shop, type] = await Promise.all([
    db.query.shops.findFirst({ where: eq(shops.id, fresh.shopId) }),
    db.query.documentTypes.findFirst({ where: eq(documentTypes.code, fresh.documentTypeCode) }),
  ])

  const [originalUrl, thumbUrl] = await Promise.all([
    storage().createSignedReadUrl(fresh.storageKey, 900),
    fresh.thumbnailKey ? storage().createSignedReadUrl(fresh.thumbnailKey, 900) : Promise.resolve(null),
  ])

  return {
    actor,
    document: fresh,
    shop,
    type,
    originalUrl,
    thumbUrl,
    editedResult: (fresh.editedResult ?? fresh.aiResult) as DeliveryChalanDocument | null,
  }
}
