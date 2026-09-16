/** Times are stored in UTC and shown in Dhaka. Getting this wrong misdates documents. */
import { describe, expect, it } from 'vitest'
import { dhakaDayRange, formatBDT, formatBytes, formatDhaka, formatUSD } from '@/lib/format'

describe('Dhaka time', () => {
  it('shows a late-UTC timestamp on the NEXT Dhaka day', () => {
    // 2026-03-01 20:00 UTC is 2026-03-02 02:00 in Dhaka (+06:00).
    const out = formatDhaka('2026-03-01T20:00:00Z', 'date')
    expect(out).toContain('02')
    expect(out).toContain('Mar')
  })

  it('handles a missing value without crashing', () => {
    expect(formatDhaka(null)).toBe('—')
    expect(formatDhaka('not a date')).toBe('—')
  })

  it('builds a day range that covers the whole Dhaka day', () => {
    const { start, end } = dhakaDayRange('2026-03-01', '2026-03-01')
    // Dhaka midnight is 18:00 the previous day in UTC.
    expect(start.toISOString()).toBe('2026-02-28T18:00:00.000Z')
    expect(end.toISOString()).toBe('2026-03-01T17:59:59.999Z')
  })
})

describe('money and sizes', () => {
  it('shows BDT with the taka sign', () => {
    expect(formatBDT(1500)).toBe('৳1,500')
    expect(formatBDT(null)).toBe('—')
  })

  it('shows USD to the requested precision', () => {
    expect(formatUSD(0.0075)).toBe('$0.0075')
    expect(formatUSD(1.5, 2)).toBe('$1.50')
  })

  it('shows readable file sizes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(20 * 1024 * 1024)).toBe('20.0 MB')
    expect(formatBytes(null)).toBe('—')
  })
})
