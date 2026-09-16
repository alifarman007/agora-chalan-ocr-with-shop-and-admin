/**
 * Local-disk storage driver, for development only.
 *
 * "Signed" URLs here are our own short-lived HMAC tokens served by
 * /api/storage/local — enough to exercise the exact same code path the Supabase
 * driver uses, without needing cloud credentials to run the app.
 */
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '@/lib/env'
import type { ObjectHead, SignedUpload, StorageService } from './types'

function root() {
  // turbopackIgnore keeps Turbopack from tracing (and bundling) the whole project
  // just because this path is computed at runtime. This driver is development-only.
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.STORAGE_LOCAL_DIR ?? '.storage')
}

function filePath(key: string) {
  // Keys are generated server-side from ids, but normalise anyway.
  const safe = key.replace(/\.\./g, '').replace(/^\/+/, '')
  return path.join(root(), safe)
}

function secret() {
  return env().BETTER_AUTH_SECRET
}

export function signLocalKey(key: string, expiresAt: number, mode: 'get' | 'put') {
  return createHmac('sha256', secret()).update(mode + ':' + key + ':' + expiresAt).digest('hex')
}

export function verifyLocalKey(
  key: string,
  expiresAt: number,
  mode: 'get' | 'put',
  token: string,
): boolean {
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false
  const expected = signLocalKey(key, expiresAt, mode)
  const a = Buffer.from(expected)
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
  )
}

export function createLocalStorage(): StorageService {
  return {
    name: 'local',

    async createSignedUploadUrl(key, contentType, ttlSeconds = 600): Promise<SignedUpload> {
      const expiresAt = Date.now() + ttlSeconds * 1000
      const token = signLocalKey(key, expiresAt, 'put')
      const url =
        baseUrl() +
        '/api/storage/local?key=' +
        encodeURIComponent(key) +
        '&expires=' +
        expiresAt +
        '&token=' +
        token
      return { url, method: 'PUT', headers: { 'content-type': contentType } }
    },

    async createSignedReadUrl(key, ttlSeconds = 600, download?: string) {
      const expiresAt = Date.now() + ttlSeconds * 1000
      const token = signLocalKey(key, expiresAt, 'get')
      const dl = download ? '&download=' + encodeURIComponent(download) : ''
      return (
        baseUrl() +
        '/api/storage/local?key=' +
        encodeURIComponent(key) +
        '&expires=' +
        expiresAt +
        '&token=' +
        token +
        dl
      )
    },

    async head(key): Promise<ObjectHead | null> {
      try {
        const s = await stat(filePath(key))
        return { size: s.size, contentType: null }
      } catch {
        return null
      }
    },

    async getBytes(key) {
      return new Uint8Array(await readFile(filePath(key)))
    },

    async put(key, bytes) {
      const target = filePath(key)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, bytes)
    },

    async delete(key) {
      await rm(filePath(key), { force: true })
    },
  }
}
