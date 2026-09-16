/**
 * Daily housekeeping. Vercel Hobby only allows a daily cron, so this is a backstop,
 * not the primary mechanism — stale jobs are mainly caught by the status poll.
 *
 * It also touches the database, which stops a Supabase Free project auto-pausing
 * after about a week of no traffic.
 */
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { reapStaleJobs } from '@/server/ocr/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const header = request.headers.get('authorization')
    if (header !== 'Bearer ' + secret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const reaped = await reapStaleJobs()
  // Keep-alive touch so a Free-plan project does not pause.
  await db.execute(sql`select 1`)

  return Response.json({ ok: true, reaped, at: new Date().toISOString() })
}
