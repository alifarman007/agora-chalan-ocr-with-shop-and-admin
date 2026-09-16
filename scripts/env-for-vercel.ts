/**
 * Prints the environment variables to paste into Vercel, read from .env.local.
 *
 * Nothing is written anywhere and nothing leaves your machine — it just saves you
 * copying eleven values out of a dotfile by hand.
 *
 * Usage: npm run env:vercel
 */
import '../src/lib/load-env'

type Row = { name: string; required: boolean; sensitive: boolean; note: string }

const ROWS: Row[] = [
  { name: 'DATABASE_URL', required: true, sensitive: true, note: 'Supabase transaction pooler, port 6543' },
  { name: 'BETTER_AUTH_SECRET', required: true, sensitive: true, note: 'signs sessions' },
  { name: 'BETTER_AUTH_URL', required: true, sensitive: false, note: 'your Vercel URL' },
  { name: 'NEXT_PUBLIC_APP_URL', required: true, sensitive: false, note: 'the same URL' },
  { name: 'DATABASE_URL_MIGRATE', required: false, sensitive: true, note: 'session pooler, port 5432 — only needed to run migrations' },
  { name: 'STORAGE_PROVIDER', required: false, sensitive: false, note: 'set to supabase once you add the two keys below' },
  { name: 'STORAGE_BUCKET', required: false, sensitive: false, note: 'agora-documents' },
  { name: 'SUPABASE_URL', required: false, sensitive: true, note: 'needed only for uploading files' },
  { name: 'SUPABASE_SECRET_KEY', required: false, sensitive: true, note: 'needed only for uploading files' },
  { name: 'GEMINI_API_KEY_1', required: false, sensitive: true, note: 'needed only for reading documents' },
  { name: 'CRON_SECRET', required: false, sensitive: true, note: 'protects the daily sweep route' },
]

const value = (name: string) => process.env[name]?.trim() ?? ''
const isLocal = (v: string) => /localhost|127\.0\.0\.1/.test(v)

console.log('\nPaste these into Vercel: Settings -> Environment Variables')
console.log('Tick BOTH "Production" and "Preview" on each one.\n')

let missing = 0
let localLeft = 0

for (const row of ROWS) {
  const v = value(row.name)
  const mark = row.required ? (v ? 'ok  ' : 'NEED') : v ? 'ok  ' : '--  '
  const flag = row.sensitive ? ' [tick Sensitive]' : ''
  if (row.required && !v) missing++
  if (v && isLocal(v)) localLeft++

  console.log(`${mark} ${row.name}${flag}`)
  if (v) {
    console.log(`     ${v}${isLocal(v) ? '   <-- still pointing at your own machine!' : ''}`)
  } else {
    console.log(`     (not set — ${row.note})`)
  }
  console.log()
}

if (localLeft > 0) {
  console.log(
    `WARNING: ${localLeft} value(s) still point at localhost. Vercel cannot reach your\n` +
      `computer. Put the Supabase connection strings in .env.local first.\n`,
  )
}
if (missing > 0) {
  console.log(`${missing} required variable(s) are still missing. The site will not work without them.\n`)
} else if (localLeft === 0) {
  console.log('All the required variables look ready to paste.\n')
}

console.log('Not set yet, and that is fine for now:')
console.log('  GEMINI_API_KEY_1      -> uploads still work, reading a document shows "could not read"')
console.log('  SUPABASE_URL / KEY    -> everything works except uploading a file')
console.log()
