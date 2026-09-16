/**
 * Environment variables, read once and validated.
 * Nothing here may ever be prefixed NEXT_PUBLIC_ except NEXT_PUBLIC_APP_URL.
 */
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_URL_MIGRATE: z.string().optional(),

  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  GEMINI_API_KEY_1: z.string().optional(),
  GEMINI_API_KEY_2: z.string().optional(),
  GEMINI_API_KEY_3: z.string().optional(),
  GEMINI_API_KEY_4: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  STORAGE_PROVIDER: z.enum(['supabase', 's3', 'local']).default('supabase'),
  STORAGE_BUCKET: z.string().default('agora-documents'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  CRON_SECRET: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export type Env = z.infer<typeof schema>

let cached: Env | null = null

export function env(): Env {
  if (cached) return cached
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    throw new Error(
      `Environment is not configured correctly:\n${lines.join('\n')}\n\n` +
        `Copy .env.example to .env.local and fill it in.`,
    )
  }
  cached = parsed.data
  return cached
}

/** The app URL, with a sensible local fallback. */
export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}
