/**
 * Reading and writing Master Control.
 *
 * Settings are cached for the life of a request. A change invalidates the tag so the
 * next request picks it up without a restart.
 */
import 'server-only'
import { cache } from 'react'
import { revalidateTag } from 'next/cache'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { appSettings, auditLog } from '@/db/schema'
import { mergeSettings, validateSetting, type Settings } from '@/lib/settings'

export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await db.select({ key: appSettings.key, value: appSettings.value }).from(appSettings)
  return mergeSettings(rows as { key: string; value: unknown }[])
})

/** Writes only the keys given, validating each one. Returns what changed. */
export async function writeSettings(
  updates: Record<string, unknown>,
  actorUserId: string,
): Promise<{ changed: string[]; errors: Record<string, string> }> {
  const before = await getSettings()
  const changed: string[] = []
  const errors: Record<string, string> = {}

  for (const [key, raw] of Object.entries(updates)) {
    const result = validateSetting(key, raw)
    if (!result.ok) {
      errors[key] = result.error
      continue
    }
    const previous = (before as Record<string, unknown>)[key]
    if (JSON.stringify(previous) === JSON.stringify(result.value)) continue

    await db
      .insert(appSettings)
      // JSON null must land as the jsonb value `null`, not as SQL NULL.
      .values({
        key,
        value: sql`${JSON.stringify(result.value)}::jsonb` as never,
        updatedByUserId: actorUserId,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: sql`${JSON.stringify(result.value)}::jsonb`,
          updatedByUserId: actorUserId,
          updatedAt: new Date(),
        },
      })

    await db.insert(auditLog).values({
      actorUserId,
      action: 'settings.update',
      targetType: 'app_setting',
      targetId: key,
      details: { before: previous ?? null, after: result.value ?? null },
    })
    changed.push(key)
  }

  if (changed.length > 0) revalidateTag('settings', 'max')
  return { changed, errors }
}
