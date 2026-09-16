/**
 * Master Control.
 *
 * One row per key in app_setting, value as jsonb, each key validated by a Zod schema
 * here. Adding a setting is a code change with NO migration. Defaults live next to the
 * validation, so a missing row is never an error.
 */
import { z } from 'zod'

export const settingsSchema = {
  'company.name': z.string().min(1).default('Agora'),
  'company.address': z.string().default(''),
  'company.phone': z.string().default(''),
  'company.logo_key': z.string().nullable().default(null),

  'upload.allowed_mime_types': z
    .array(z.string())
    .default(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  'upload.max_file_bytes': z
    .number()
    .int()
    .positive()
    .default(20 * 1024 * 1024),
  'upload.max_pdf_pages': z.number().int().positive().default(20),

  'approval.disallow_self_approval': z.boolean().default(true),
  'approval.require_note_on_reject': z.boolean().default(true),
  'approval.require_note_on_approve': z.boolean().default(false),

  'ocr.default_model': z.string().default('gemini-3.6-flash'),
  'ocr.max_attempts': z.number().int().min(1).max(10).default(3),
  'ocr.stale_after_minutes': z.number().int().min(1).default(10),

  /**
   * Real Gemini list price, checked 2026-09-16. The old browser app used
   * $0.10/$0.40, which is roughly 8x too low. Prices double on 2027-01-01, hence
   * the date-aware shape.
   */
  'cost.pricing': z
    .record(
      z.string(),
      z.object({
        input_usd_per_1m: z.number(),
        output_usd_per_1m: z.number(),
        until: z.string().nullable().optional(),
        then: z
          .object({ input_usd_per_1m: z.number(), output_usd_per_1m: z.number() })
          .nullable()
          .optional(),
      }),
    )
    .default({
      'gemini-3.6-flash': {
        input_usd_per_1m: 0.75,
        output_usd_per_1m: 3.75,
        until: '2026-12-31',
        then: { input_usd_per_1m: 1.5, output_usd_per_1m: 7.5 },
      },
      'gemini-3-flash-preview': { input_usd_per_1m: 0.5, output_usd_per_1m: 3.0 },
    }),
  'cost.usd_to_bdt': z.number().positive().default(122),

  'display.timezone': z.string().default('Asia/Dhaka'),
  'display.currency': z.string().default('BDT'),
  'display.thumbnail_max_px': z.number().int().positive().default(480),
} as const

export type SettingKey = keyof typeof settingsSchema
export type Settings = { [K in SettingKey]: z.infer<(typeof settingsSchema)[K]> }

export const SETTING_KEYS = Object.keys(settingsSchema) as SettingKey[]

/** Keys any signed-in user may read. Everything else is admin-only. */
export const PUBLIC_SETTING_KEYS: SettingKey[] = [
  'company.name',
  'company.logo_key',
  'upload.allowed_mime_types',
  'upload.max_file_bytes',
  'upload.max_pdf_pages',
  'display.timezone',
  'display.currency',
]

export function defaultSettings(): Settings {
  const out = {} as Record<string, unknown>
  for (const key of SETTING_KEYS) {
    out[key] = settingsSchema[key].parse(undefined)
  }
  return out as Settings
}

/** Merge DB rows over the code defaults. A bad stored value falls back to the default. */
export function mergeSettings(rows: { key: string; value: unknown }[]): Settings {
  const out = defaultSettings() as Record<string, unknown>
  for (const row of rows) {
    if (!(row.key in settingsSchema)) continue
    const parsed = settingsSchema[row.key as SettingKey].safeParse(row.value)
    if (parsed.success) out[row.key] = parsed.data
  }
  return out as Settings
}

export function validateSetting(key: string, value: unknown) {
  if (!(key in settingsSchema)) {
    return { ok: false as const, error: `Unknown setting: ${key}` }
  }
  const parsed = settingsSchema[key as SettingKey].safeParse(value)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues.map((i) => i.message).join(', ') }
  }
  return { ok: true as const, value: parsed.data }
}

/** Human labels and grouping for the Master Control screen. */
export const SETTING_GROUPS: { label: string; description: string; keys: SettingKey[] }[] = [
  {
    label: 'Company',
    description: 'Shown in the header and on exports.',
    keys: ['company.name', 'company.address', 'company.phone', 'company.logo_key'],
  },
  {
    label: 'Uploads',
    description: 'What staff are allowed to upload.',
    keys: ['upload.allowed_mime_types', 'upload.max_file_bytes', 'upload.max_pdf_pages'],
  },
  {
    label: 'Approval',
    description: 'The rules approvers work under.',
    keys: [
      'approval.disallow_self_approval',
      'approval.require_note_on_reject',
      'approval.require_note_on_approve',
    ],
  },
  {
    label: 'OCR',
    description: 'Which model reads the documents, and how hard it retries.',
    keys: ['ocr.default_model', 'ocr.max_attempts', 'ocr.stale_after_minutes'],
  },
  {
    label: 'Cost',
    description: 'Used to estimate what each document costs to read.',
    keys: ['cost.pricing', 'cost.usd_to_bdt'],
  },
  {
    label: 'Display',
    description: 'Time zone, currency and image sizes.',
    keys: ['display.timezone', 'display.currency', 'display.thumbnail_max_px'],
  },
]

export const SETTING_LABELS: Record<SettingKey, string> = {
  'company.name': 'Company name',
  'company.address': 'Address',
  'company.phone': 'Phone',
  'company.logo_key': 'Logo',
  'upload.allowed_mime_types': 'Allowed file types',
  'upload.max_file_bytes': 'Largest file (bytes)',
  'upload.max_pdf_pages': 'Most PDF pages',
  'approval.disallow_self_approval': 'A user cannot approve what they submitted',
  'approval.require_note_on_reject': 'A note is required when rejecting',
  'approval.require_note_on_approve': 'A note is required when approving',
  'ocr.default_model': 'Gemini model',
  'ocr.max_attempts': 'Most OCR attempts',
  'ocr.stale_after_minutes': 'Treat OCR as failed after (minutes)',
  'cost.pricing': 'Token prices (USD per 1M)',
  'cost.usd_to_bdt': 'USD to BDT rate',
  'display.timezone': 'Time zone',
  'display.currency': 'Currency',
  'display.thumbnail_max_px': 'Thumbnail size (px)',
}
