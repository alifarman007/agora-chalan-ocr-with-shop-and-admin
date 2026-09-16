/**
 * The storage boundary.
 *
 * Feature code only ever sees this interface. Supabase Storage today; S3, MinIO or a
 * local disk tomorrow, by changing STORAGE_PROVIDER and the credentials. Only
 * bucket-relative object keys are stored in the database, so a provider move is a
 * file copy plus env vars, with no code change.
 */

export type SignedUpload = {
  /** Where the browser PUTs the bytes. */
  url: string
  /** Headers the browser must send with the PUT. */
  headers: Record<string, string>
  /** HTTP method for the upload. */
  method: 'PUT' | 'POST'
}

export type ObjectHead = {
  size: number
  contentType: string | null
}

export interface StorageService {
  readonly name: string

  /** Mint a URL the browser can upload to directly, so file bytes never pass
   *  through a serverless function (Vercel caps request bodies at 4.5 MB). */
  createSignedUploadUrl(
    key: string,
    contentType: string,
    ttlSeconds?: number,
  ): Promise<SignedUpload>

  /** Short-lived read URL, minted only after a permission check. */
  createSignedReadUrl(key: string, ttlSeconds?: number, download?: string): Promise<string>

  /** Confirm an object exists and how big it is. Null when missing. */
  head(key: string): Promise<ObjectHead | null>

  /** Server-side read, used by the OCR worker. */
  getBytes(key: string): Promise<Uint8Array>

  /** Server-side write, used for thumbnails. */
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>

  delete(key: string): Promise<void>
}

/** Keys are a pure function of ids, never of user input. */
export function originalKey(shopId: string, documentId: string, ext: string): string {
  return `shops/${shopId}/docs/${documentId}/original.${ext}`
}

export function thumbnailKey(shopId: string, documentId: string): string {
  return `shops/${shopId}/docs/${documentId}/thumb.webp`
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

export function extensionForMime(mime: string): string | null {
  return EXT_BY_MIME[mime.toLowerCase()] ?? null
}
