import 'server-only'
import { env } from '@/lib/env'
import { createLocalStorage } from './local'
import { createSupabaseStorage } from './supabase'
import type { StorageService } from './types'

let cached: StorageService | null = null

/** The one way to reach files. The provider comes from env, never from code. */
export function storage(): StorageService {
  if (cached) return cached
  const provider = env().STORAGE_PROVIDER
  if (provider === 'supabase') {
    cached = createSupabaseStorage()
  } else if (provider === 'local') {
    cached = createLocalStorage()
  } else {
    throw new Error('STORAGE_PROVIDER "' + provider + '" is not implemented yet.')
  }
  return cached
}

export * from './types'
