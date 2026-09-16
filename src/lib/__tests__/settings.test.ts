/** Master Control must never hand the app a bad value, and a missing row is never an error. */
import { describe, expect, it } from 'vitest'
import {
  PUBLIC_SETTING_KEYS,
  SETTING_GROUPS,
  SETTING_KEYS,
  SETTING_LABELS,
  defaultSettings,
  mergeSettings,
  validateSetting,
} from '@/lib/settings'

describe('settings defaults', () => {
  it('produces a value for every key', () => {
    const d = defaultSettings() as Record<string, unknown>
    for (const key of SETTING_KEYS) {
      expect(d[key], key + ' has no default').not.toBeUndefined()
    }
  })

  it('defaults to the safe approval rules', () => {
    const d = defaultSettings()
    expect(d['approval.disallow_self_approval']).toBe(true)
    expect(d['approval.require_note_on_reject']).toBe(true)
  })

  it('defaults to the approved model and Dhaka time', () => {
    const d = defaultSettings()
    expect(d['ocr.default_model']).toBe('gemini-3.6-flash')
    expect(d['display.timezone']).toBe('Asia/Dhaka')
    expect(d['display.currency']).toBe('BDT')
  })

  it("uses Google's real prices, not the old app's 8x-too-low ones", () => {
    const pricing = defaultSettings()['cost.pricing']
    expect(pricing['gemini-3.6-flash'].input_usd_per_1m).toBe(0.75)
    expect(pricing['gemini-3.6-flash'].output_usd_per_1m).toBe(3.75)
  })

  it('labels and groups every key', () => {
    const grouped = new Set(SETTING_GROUPS.flatMap((g) => g.keys))
    for (const key of SETTING_KEYS) {
      expect(SETTING_LABELS[key], key + ' has no label').toBeTruthy()
      expect(grouped.has(key), key + ' is in no group').toBe(true)
    }
  })

  it('keeps cost and approval rules out of the public keys', () => {
    expect(PUBLIC_SETTING_KEYS).not.toContain('cost.pricing')
    expect(PUBLIC_SETTING_KEYS).not.toContain('approval.disallow_self_approval')
  })
})

describe('validateSetting', () => {
  it('accepts a good value', () => {
    const r = validateSetting('ocr.max_attempts', 5)
    expect(r.ok).toBe(true)
  })

  it('rejects an unknown key', () => {
    expect(validateSetting('nope.nope', 1).ok).toBe(false)
  })

  it('rejects a wrong type', () => {
    expect(validateSetting('approval.disallow_self_approval', 'yes').ok).toBe(false)
    expect(validateSetting('upload.max_file_bytes', -5).ok).toBe(false)
    expect(validateSetting('ocr.max_attempts', 0).ok).toBe(false)
  })
})

describe('mergeSettings', () => {
  it('lets a stored row win over the default', () => {
    const merged = mergeSettings([{ key: 'company.name', value: 'Agora Ltd' }])
    expect(merged['company.name']).toBe('Agora Ltd')
  })

  it('falls back to the default when a stored value is corrupt', () => {
    const merged = mergeSettings([{ key: 'ocr.max_attempts', value: 'lots' }])
    expect(merged['ocr.max_attempts']).toBe(3)
  })

  it('ignores rows for keys we no longer have', () => {
    const merged = mergeSettings([{ key: 'removed.key', value: 1 }])
    expect(merged['company.name']).toBe('Agora')
  })
})
