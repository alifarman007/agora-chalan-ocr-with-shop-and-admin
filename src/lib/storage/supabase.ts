/**
 * Supabase Storage driver.
 *
 * Deliberately plain fetch against the Storage REST API — no supabase-js. Storage is
 * not data access, but keeping the dependency out means this file is the only thing
 * that would change when we move to S3 or MinIO.
 *
 * Note: Supabase fixes the lifetime of signed UPLOAD urls at 2 hours and does not let
 * you shorten it. Read URLs do take an expiry, and we keep those short.
 */
import 'server-only'
import { env } from '@/lib/env'
import type { ObjectHead, SignedUpload, StorageService } from './types'

function config() {
  const e = env()
  if (!e.SUPABASE_URL || !e.SUPABASE_SECRET_KEY) {
    throw new Error(
      'STORAGE_PROVIDER=supabase needs SUPABASE_URL and SUPABASE_SECRET_KEY in the environment.',
    )
  }
  return {
    url: e.SUPABASE_URL.replace(/\/+$/, ''),
    secret: e.SUPABASE_SECRET_KEY,
    bucket: e.STORAGE_BUCKET,
  }
}

function authHeaders(secret: string) {
  return { authorization: 'Bearer ' + secret, apikey: secret }
}

export function createSupabaseStorage(): StorageService {
  return {
    name: 'supabase',

    async createSignedUploadUrl(key, contentType): Promise<SignedUpload> {
      const { url, secret, bucket } = config()
      const res = await fetch(url + '/storage/v1/object/upload/sign/' + bucket + '/' + key, {
        method: 'POST',
        headers: { ...authHeaders(secret), 'content-type': 'application/json' },
        body: JSON.stringify({ upsert: false }),
      })
      if (!res.ok) {
        throw new Error('Could not create an upload URL (' + res.status + '): ' + (await res.text()))
      }
      const body = (await res.json()) as { url?: string; token?: string }
      let token = body.token
      if (!token && body.url) {
        const qs = body.url.split('?')[1] ?? ''
        token = new URLSearchParams(qs).get('token') ?? undefined
      }
      if (!token) throw new Error('Supabase did not return an upload token.')
      return {
        url: url + '/storage/v1/object/upload/sign/' + bucket + '/' + key + '?token=' + token,
        method: 'PUT',
        headers: { 'content-type': contentType },
      }
    },

    async createSignedReadUrl(key, ttlSeconds = 600, download?: string) {
      const { url, secret, bucket } = config()
      const res = await fetch(url + '/storage/v1/object/sign/' + bucket + '/' + key, {
        method: 'POST',
        headers: { ...authHeaders(secret), 'content-type': 'application/json' },
        body: JSON.stringify(
          download ? { expiresIn: ttlSeconds, download } : { expiresIn: ttlSeconds },
        ),
      })
      if (!res.ok) {
        throw new Error('Could not sign a read URL (' + res.status + '): ' + (await res.text()))
      }
      const body = (await res.json()) as { signedURL?: string; signedUrl?: string }
      const signed = body.signedURL ?? body.signedUrl
      if (!signed) throw new Error('Supabase did not return a signed URL.')
      return url + '/storage/v1' + (signed.startsWith('/') ? signed : '/' + signed)
    },

    async head(key): Promise<ObjectHead | null> {
      const { url, secret, bucket } = config()
      const res = await fetch(url + '/storage/v1/object/info/' + bucket + '/' + key, {
        headers: authHeaders(secret),
      })
      if (res.status === 404 || res.status === 400) return null
      if (!res.ok) throw new Error('Storage head failed (' + res.status + ')')
      const info = (await res.json()) as {
        size?: number
        contentType?: string
        mimetype?: string
      }
      return {
        size: Number(info.size ?? 0),
        contentType: info.contentType ?? info.mimetype ?? null,
      }
    },

    async getBytes(key) {
      const { url, secret, bucket } = config()
      const res = await fetch(url + '/storage/v1/object/' + bucket + '/' + key, {
        headers: authHeaders(secret),
      })
      if (!res.ok) {
        throw new Error('Could not read ' + key + ' from storage (' + res.status + ')')
      }
      return new Uint8Array(await res.arrayBuffer())
    },

    async put(key, bytes, contentType) {
      const { url, secret, bucket } = config()
      const res = await fetch(url + '/storage/v1/object/' + bucket + '/' + key, {
        method: 'POST',
        headers: { ...authHeaders(secret), 'content-type': contentType, 'x-upsert': 'true' },
        body: bytes as unknown as BodyInit,
      })
      if (!res.ok) {
        throw new Error('Could not write ' + key + ' to storage (' + res.status + ')')
      }
    },

    async delete(key) {
      const { url, secret, bucket } = config()
      await fetch(url + '/storage/v1/object/' + bucket + '/' + key, {
        method: 'DELETE',
        headers: authHeaders(secret),
      })
    },
  }
}
