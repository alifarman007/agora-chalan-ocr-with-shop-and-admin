/**
 * Turns an audit row's `details` jsonb into readable lines.
 *
 * Nobody should have to read raw JSON to find out what changed, so a before/after
 * pair becomes "Field: old -> new" and a list becomes "Added" / "Removed".
 */
import { SETTING_LABELS, type SettingKey } from '@/lib/settings'

export type ChangeLine = {
  label: string
  /** Either a before/after pair… */
  from?: string
  to?: string
  /** …or a single plain value. */
  text?: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(empty)'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    return value.length === 0 ? '(none)' : value.map((v) => formatValue(v)).join(', ')
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function humanKey(key: string): string {
  const words = key.replace(/[._]/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function diffArrays(before: unknown[], after: unknown[]): ChangeLine[] {
  const b = before.map((v) => formatValue(v))
  const a = after.map((v) => formatValue(v))
  const added = a.filter((v) => !b.includes(v))
  const removed = b.filter((v) => !a.includes(v))
  const lines: ChangeLine[] = []
  if (added.length > 0) lines.push({ label: 'Added', text: added.join(', ') })
  if (removed.length > 0) lines.push({ label: 'Removed', text: removed.join(', ') })
  if (lines.length === 0) lines.push({ label: 'Changed', text: 'nothing' })
  return lines
}

export function changeLines(
  details: unknown,
  target?: { targetType?: string | null; targetId?: string | null },
): ChangeLine[] {
  if (details === null || details === undefined) return []
  if (!isPlainObject(details)) return [{ label: 'Details', text: formatValue(details) }]

  const hasPair = 'before' in details || 'after' in details
  if (!hasPair) {
    return Object.entries(details).map(([key, value]) => ({
      label: humanKey(key),
      text: formatValue(value),
    }))
  }

  const before = details.before
  const after = details.after

  // A setting row names its key in targetId, so use the friendly label.
  let pairLabel = 'Value'
  if (target?.targetType === 'app_setting' && target.targetId) {
    const key = target.targetId as SettingKey
    pairLabel = SETTING_LABELS[key] ?? humanKey(target.targetId)
  }

  if (Array.isArray(before) && Array.isArray(after)) return diffArrays(before, after)

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    const lines = keys
      .filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null))
      .map((k) => ({
        label: humanKey(k),
        from: formatValue(before[k]),
        to: formatValue(after[k]),
      }))
    return lines.length > 0 ? lines : [{ label: 'Changed', text: 'nothing' }]
  }

  if ((before === null || before === undefined) && isPlainObject(after)) {
    return Object.entries(after).map(([key, value]) => ({
      label: humanKey(key),
      text: formatValue(value),
    }))
  }

  return [{ label: pairLabel, from: formatValue(before), to: formatValue(after) }]
}

/** Friendly names for the actions we write ourselves. */
const ACTION_LABELS: Record<string, string> = {
  'settings.update': 'Master Control changed',
  'role.permissions.update': 'Role permissions changed',
  'user.password.change': 'Password changed',
  'user.profile.update': 'Profile updated',
  'user.create': 'User created',
  'user.update': 'User updated',
  'shop.create': 'Shop created',
  'shop.update': 'Shop updated',
  'membership.update': 'Shop members changed',
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? humanKey(action)
}
