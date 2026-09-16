/**
 * Polled every few seconds while a document is being read.
 *
 * This is also where stale jobs get noticed: Vercel's Hobby plan only allows a DAILY
 * cron, so waiting for cron would leave a crashed job looking "in progress" for hours.
 * Reaping here makes it visible within seconds.
 */
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { documents } from '@/db/schema'
import { AuthError, requireDocument } from '@/lib/auth/session'
import { reapStaleJobs } from '@/server/ocr/pipeline'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  try {
    await requireDocument(id, 'document.view')
    await reapStaleJobs(id)

    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, id),
      columns: {
        status: true,
        ocrAttempts: true,
        processingError: true,
        revision: true,
        thumbnailKey: true,
        rawOcrText: true,
      },
    })
    if (!doc) return Response.json({ error: 'Not found' }, { status: 404 })

    // Mirrors the approved app's two-step progress: step 1 is OCR, step 2 is
    // structuring, and raw text appearing is what tells us step 1 finished.
    const step =
      doc.status !== 'processing' ? null : doc.rawOcrText ? 'structuring' : 'ocr'

    return Response.json(
      {
        status: doc.status,
        step,
        attempt: doc.ocrAttempts,
        error: doc.processingError,
        revision: doc.revision,
        thumbnailReady: Boolean(doc.thumbnailKey),
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    if (error instanceof AuthError) {
      const status = error.code === 'UNAUTHENTICATED' ? 401 : error.code === 'NOT_FOUND' ? 404 : 403
      return Response.json({ error: error.message }, { status })
    }
    console.error('[api/status]', error)
    return Response.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
