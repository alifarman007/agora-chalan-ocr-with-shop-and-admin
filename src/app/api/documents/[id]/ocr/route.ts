/**
 * Starts an OCR run.
 *
 * Returns 202 immediately and does the work in after(), because two Gemini calls take
 * 30-120 seconds and nobody should stare at a hanging request. A Route Handler rather
 * than a Server Action because only a route can set maxDuration.
 *
 * The conditional UPDATE IS the lock: a second caller matches zero rows and simply
 * gets the current status back.
 */
import { after } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { documentEvents, documents } from '@/db/schema'
import { AuthError, requireDocument } from '@/lib/auth/session'
import { getSettings } from '@/server/settings'
import { runOcr } from '@/server/ocr/pipeline'

// Vercel Hobby caps this at 300s, which is also the default there.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  try {
    // The first run needs upload rights; a retry needs retry rights.
    const existing = await db.query.documents.findFirst({
      where: eq(documents.id, id),
      columns: { status: true, ocrAttempts: true },
    })
    const permission = existing?.status === 'failed' ? 'document.retry_ocr' : 'document.upload'
    const { actor, doc } = await requireDocument(id, permission, 'upload')

    if (doc.status === 'processing') {
      return Response.json({ status: 'processing', attempt: doc.ocrAttempts }, { status: 202 })
    }
    if (!['uploaded', 'failed'].includes(doc.status)) {
      return Response.json(
        { error: 'This document has already been read.', status: doc.status },
        { status: 409 },
      )
    }

    const settings = await getSettings()
    const isAdmin = actor.permissions.has('shop.view_all')
    if (!isAdmin && doc.ocrAttempts >= settings['ocr.max_attempts']) {
      return Response.json(
        { error: 'This document has failed too many times. Ask an admin to retry it.' },
        { status: 429 },
      )
    }

    const model = settings['ocr.default_model']

    // Claim it. Zero rows means somebody else already started.
    const claimed = await db
      .update(documents)
      .set({
        status: 'processing',
        ocrAttempts: sql`${documents.ocrAttempts} + 1`,
        ocrStartedAt: new Date(),
        ocrFinishedAt: null,
        processingError: null,
        processingModel: model,
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, id), sql`${documents.status} in ('uploaded','failed')`))
      .returning({ attempt: documents.ocrAttempts })

    if (claimed.length === 0) {
      const now = await db.query.documents.findFirst({
        where: eq(documents.id, id),
        columns: { status: true, ocrAttempts: true },
      })
      return Response.json({ status: now?.status ?? 'unknown' }, { status: 202 })
    }

    const attempt = claimed[0].attempt
    await db.insert(documentEvents).values({
      documentId: id,
      eventType: 'ocr_started',
      actorUserId: actor.id,
      fromStatus: doc.status,
      toStatus: 'processing',
      details: { attempt, model },
    })

    // Respond now; read the document after the response has gone out.
    after(async () => {
      await runOcr(id, attempt)
    })

    return Response.json({ status: 'processing', attempt }, { status: 202 })
  } catch (error) {
    if (error instanceof AuthError) {
      const status = error.code === 'UNAUTHENTICATED' ? 401 : error.code === 'NOT_FOUND' ? 404 : 403
      return Response.json({ error: error.message }, { status })
    }
    console.error('[api/ocr]', error)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
