/**
 * Serves the original file by REDIRECTING to a short-lived signed URL.
 *
 * The bytes never pass through the function: Vercel caps both request and response
 * bodies at 4.5 MB, and a scanned chalan can easily be larger.
 */
import { AuthError, requireDocument } from '@/lib/auth/session'
import { storage } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  try {
    const { doc } = await requireDocument(id, 'document.download')
    const wantsDownload = new URL(request.url).searchParams.get('download') === '1'
    const url = await storage().createSignedReadUrl(
      doc.storageKey,
      600,
      wantsDownload ? doc.originalFilename : undefined,
    )
    return Response.redirect(url, 302)
  } catch (error) {
    if (error instanceof AuthError) {
      const status = error.code === 'UNAUTHENTICATED' ? 401 : error.code === 'NOT_FOUND' ? 404 : 403
      return Response.json({ error: error.message }, { status })
    }
    console.error('[api/files/original]', error)
    return Response.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
