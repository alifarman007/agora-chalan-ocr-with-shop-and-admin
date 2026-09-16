/**
 * The local-disk storage driver's "signed URL" endpoint. DEVELOPMENT ONLY.
 *
 * It exists so the whole upload -> OCR -> serve path can be exercised without cloud
 * credentials, using the same signed-URL shape the Supabase driver produces.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '@/lib/env'
import { verifyLocalKey } from '@/lib/storage/local'

export const dynamic = 'force-dynamic'

function root() {
  return path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? '.storage')
}

function resolveKey(key: string) {
  const safe = key.replace(/\.\./g, '').replace(/^\/+/, '')
  return path.join(root(), safe)
}

function guard(request: Request, mode: 'get' | 'put') {
  if (env().STORAGE_PROVIDER !== 'local') return null
  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  const expires = Number(url.searchParams.get('expires'))
  const token = url.searchParams.get('token')
  if (!key || !token || !Number.isFinite(expires)) return null
  if (!verifyLocalKey(key, expires, mode, token)) return null
  return { key, download: url.searchParams.get('download') }
}

export async function PUT(request: Request) {
  const ok = guard(request, 'put')
  if (!ok) return Response.json({ error: 'Invalid or expired upload link.' }, { status: 403 })
  const target = resolveKey(ok.key)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, Buffer.from(await request.arrayBuffer()))
  return Response.json({ ok: true })
}

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
}

export async function GET(request: Request) {
  const ok = guard(request, 'get')
  if (!ok) return Response.json({ error: 'Invalid or expired link.' }, { status: 403 })
  const target = resolveKey(ok.key)
  try {
    await stat(target)
  } catch {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  const bytes = await readFile(target)
  const type = TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream'
  const headers: Record<string, string> = {
    'content-type': type,
    'cache-control': 'private, max-age=300',
  }
  if (ok.download) {
    headers['content-disposition'] = 'attachment; filename="' + ok.download.replace(/"/g, '') + '"'
  }
  return new Response(new Uint8Array(bytes), { headers })
}
