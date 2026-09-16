/**
 * Display helpers.
 *
 * Every timestamp is stored as timestamptz in UTC and shown in Asia/Dhaka.
 * Bangladesh has no daylight saving, so the offset is a constant +06:00 — but we
 * still go through Intl so the rule lives in one place.
 */
export const DHAKA = 'Asia/Dhaka'

export function formatDhaka(
  value: Date | string | null | undefined,
  style: 'date' | 'time' | 'datetime' | 'short' = 'datetime',
): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'

  const base: Intl.DateTimeFormatOptions = { timeZone: DHAKA }
  const options: Intl.DateTimeFormatOptions =
    style === 'date'
      ? { ...base, day: '2-digit', month: 'short', year: 'numeric' }
      : style === 'time'
        ? { ...base, hour: '2-digit', minute: '2-digit', hour12: true }
        : style === 'short'
          ? { ...base, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }
          : {
              ...base,
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            }
  return new Intl.DateTimeFormat('en-GB', options).format(date)
}

/** "3 minutes ago", "in 2 days". */
export function timeAgo(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ]
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(seconds) >= secondsInUnit || unit === 'second') {
      return rtf.format(Math.round(seconds / secondsInUnit), unit)
    }
  }
  return '—'
}

/** Money on a chalan is BDT. */
export function formatBDT(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(n)) return String(value)
  return `৳${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)}`
}

export function formatUSD(value: number | string | null | undefined, digits = 4): string {
  if (value === null || value === undefined) return '—'
  const n = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(n)) return '—'
  return `$${n.toFixed(digits)}`
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/** Start and end of a Dhaka day, as UTC instants, for report filters. */
export function dhakaDayRange(from: string, to: string): { start: Date; end: Date } {
  // Dhaka is a fixed +06:00.
  return {
    start: new Date(`${from}T00:00:00+06:00`),
    end: new Date(`${to}T23:59:59.999+06:00`),
  }
}

export function todayInDhaka(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DHAKA }).format(new Date())
}

export function daysAgoInDhaka(days: number): string {
  const d = new Date(Date.now() - days * 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: DHAKA }).format(d)
}
