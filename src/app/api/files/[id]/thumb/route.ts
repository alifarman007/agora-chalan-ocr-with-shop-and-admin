/** Thumbnail, as a redirect to a signed URL. Falls back to a placeholder icon. */
import { AuthError, requireDocument } from '@/lib/auth/session'
import { storage } from '@/lib/storage'

export const dynamic = 'force-dynamic'

const PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M28 4H12a4 4 0 0 0-4 4v32a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4V16z"/><path d="M28 4v12h12"/></svg>`

function placeholder() {
  return new Response(PLACEHOLDER, {
    headers: { 'content-type': 'image/svg+xml', 'cache-control': 'private, max-age=300' },
  })
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  try {
    const { doc } = await requireDocument(id, 'document.view')
    if (!doc.thumbnailKey) return placeholder()
    const url = await storage().createSignedReadUrl(doc.thumbnailKey, 600)
    return Response.redirect(url, 302)
  } catch (error) {
    if (error instanceof AuthError) {
      const status = error.code === 'UNAUTHENTICATED' ? 401 : error.code === 'NOT_FOUND' ? 404 : 403
      return Response.json({ error: error.message }, { status })
    }
    console.error('[api/files/thumb]', error)
    return placeholder()
  }
}
