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

  it('labels every key', () => {
    for (const key of SETTING_KEYS) {
      expect(SETTING_LABELS[key], key + ' has no label').toBeTruthy()
    }
  })

  it('only groups keys that really exist', () => {
    for (const group of SETTING_GROUPS) {
      for (const key of group.keys) {
        expect(SETTING_KEYS, group.label + ' groups unknown ' + key).toContain(key)
      }
    }
  })

  it('hides the OCR and cost settings from Master Control, but keeps them working', () => {
    // They are read by the OCR pipeline and the cost report; an administrator just
    // does not edit them from the screen. Removing the KEYS would break OCR.
    const shown = new Set(SETTING_GROUPS.flatMap((g) => g.keys))
    for (const hidden of [
      'ocr.default_model',
      'ocr.max_attempts',
      'ocr.stale_after_minutes',
      'cost.pricing',
      'cost.usd_to_bdt',
    ] as const) {
      expect(shown.has(hidden), hidden + ' should not be on the screen').toBe(false)
      expect(SETTING_KEYS, hidden + ' must still exist').toContain(hidden)
      expect(
        (defaultSettings() as Record<string, unknown>)[hidden],
        hidden + ' must still have a default',
      ).not.toBeUndefined()
    }
  })

  it('leaves four tabs: Company, Uploads, Approval, Display', () => {
    expect(SETTING_GROUPS.map((g) => g.label)).toEqual([
      'Company',
      'Uploads',
      'Approval',
      'Display',
    ])
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
