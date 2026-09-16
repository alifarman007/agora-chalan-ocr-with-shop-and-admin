/**
 * Works out which control a setting needs, from the Zod schema itself.
 *
 * The schema is the single source of truth, so adding a setting in
 * `src/lib/settings.ts` gives you the right control here with no extra work.
 */
import { settingsSchema, type SettingKey } from '@/lib/settings'

/** Wrappers that hide the real type, e.g. `z.string().nullable().default(null)`. */
const WRAPPERS = new Set([
  'default',
  'prefault',
  'optional',
  'nullable',
  'nonoptional',
  'catch',
  'readonly',
])

type ZodInternals = { _zod?: { def?: { type?: string; innerType?: unknown } } }

/** Unwraps a schema down to its base type name: 'string', 'number', 'boolean', … */
export function baseTypeOf(key: SettingKey): string {
  let current: unknown = settingsSchema[key]
  for (let i = 0; i < 10; i++) {
    const def = (current as ZodInternals)?._zod?.def
    if (!def?.type) return 'unknown'
    if (WRAPPERS.has(def.type) && def.innerType) {
      current = def.innerType
      continue
    }
    return def.type
  }
  return 'unknown'
}

/** True when the schema accepts null, so an empty box should save null not "". */
export function isNullableSetting(key: SettingKey): boolean {
  let current: unknown = settingsSchema[key]
  for (let i = 0; i < 10; i++) {
    const def = (current as ZodInternals)?._zod?.def
    if (!def?.type) return false
    if (def.type === 'nullable') return true
    if (WRAPPERS.has(def.type) && def.innerType) {
      current = def.innerType
      continue
    }
    return false
  }
  return false
}

export type ControlKind =
  | 'text'
  | 'number'
  | 'megabytes'
  | 'boolean'
  | 'mimeTypes'
  | 'pricing'
  | 'unsupported'

export function controlKindFor(key: SettingKey): ControlKind {
  // Two keys want a friendlier control than their raw type suggests.
  if (key === 'upload.max_file_bytes') return 'megabytes'
  if (key === 'cost.pricing') return 'pricing'

  switch (baseTypeOf(key)) {
    case 'string':
      return 'text'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'array':
      return 'mimeTypes'
    case 'record':
    case 'object':
      return 'pricing'
    default:
      return 'unsupported'
  }
}

/** The file types staff may be allowed to upload. */
export const MIME_CHOICES: { value: string; label: string }[] = [
  { value: 'image/jpeg', label: 'JPEG photo (.jpg)' },
  { value: 'image/png', label: 'PNG image (.png)' },
  { value: 'image/webp', label: 'WebP image (.webp)' },
  { value: 'application/pdf', label: 'PDF file (.pdf)' },
]

export const BYTES_PER_MB = 1024 * 1024

/** Short help text under a field. Plain English, one or two sentences. */
export const SETTING_HINTS: Partial<Record<SettingKey, string>> = {
  'company.name': 'Shown in the sidebar, the header and on every export.',
  'company.address': 'Printed on exports. Leave empty to hide it.',
  'company.phone': 'A contact number for exports and reports.',
  'company.logo_key': 'The storage key of the logo file. Leave empty for no logo.',
  'upload.allowed_mime_types': 'Anything not ticked here is refused at upload time.',
  'upload.max_file_bytes': 'Larger files are refused before they are uploaded.',
  'upload.max_pdf_pages': 'A PDF with more pages than this is refused.',
  'approval.disallow_self_approval':
    'When on, nobody can approve a document they submitted themselves. Recommended.',
  'approval.require_note_on_reject':
    'When on, an approver must write a reason before they can reject.',
  'approval.require_note_on_approve':
    'When on, an approver must write a note even when they approve.',
  'ocr.default_model':
    'The Gemini model that reads documents. Changing this affects new documents only.',
  'ocr.max_attempts': 'How many times a document is retried before it is marked failed.',
  'ocr.stale_after_minutes':
    'A document still processing after this long is treated as failed, so it can be retried.',
  'cost.pricing':
    'Used only to estimate what reading a document costs. It does not change what Google charges.',
  'cost.usd_to_bdt': 'How many taka to one US dollar, for showing costs in BDT.',
  'display.timezone': 'All times are stored in UTC and shown in this zone.',
  'display.currency': 'The currency label used on money figures.',
  'display.thumbnail_max_px': 'The longest side of the small preview images, in pixels.',
}
