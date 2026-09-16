'use client'

import * as React from 'react'
import { Save } from 'lucide-react'
import {
  SETTING_GROUPS,
  SETTING_LABELS,
  type SettingKey,
  type Settings,
} from '@/lib/settings'
import { updateSettings } from '@/server/actions/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldError, FieldHint, Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toast'
import {
  BYTES_PER_MB,
  MIME_CHOICES,
  SETTING_HINTS,
  controlKindFor,
  isNullableSetting,
} from './setting-kind'
import {
  PricingEditor,
  pricingToRows,
  rowsToPricing,
  validateRows,
  type PriceRow,
} from './pricing-editor'

type DisplayValue = string | boolean | string[] | PriceRow[]
type WireResult = { ok: true; value: unknown } | { ok: false; error: string }

/** Stored value -> what the control shows. */
function toDisplay(key: SettingKey, value: unknown): DisplayValue {
  switch (controlKindFor(key)) {
    case 'boolean':
      return Boolean(value)
    case 'mimeTypes':
      return Array.isArray(value) ? (value as string[]).map(String) : []
    case 'pricing':
      return pricingToRows(value)
    case 'megabytes':
      return String(Math.round((Number(value) / BYTES_PER_MB) * 100) / 100)
    case 'number':
      return String(value ?? '')
    default:
      return value === null || value === undefined ? '' : String(value)
  }
}

/** What the control shows -> the value we send to the server. */
function toWire(key: SettingKey, display: DisplayValue): WireResult {
  switch (controlKindFor(key)) {
    case 'boolean':
      return { ok: true, value: Boolean(display) }
    case 'mimeTypes': {
      const list = Array.isArray(display) ? (display as string[]) : []
      if (list.length === 0) return { ok: false, error: 'Pick at least one file type.' }
      return { ok: true, value: list }
    }
    case 'pricing': {
      const rows = display as PriceRow[]
      const problem = validateRows(rows)
      if (problem) return { ok: false, error: problem }
      return { ok: true, value: rowsToPricing(rows) }
    }
    case 'number': {
      const text = String(display).trim()
      const n = Number(text)
      if (text === '' || !Number.isFinite(n)) return { ok: false, error: 'Enter a number.' }
      return { ok: true, value: n }
    }
    case 'megabytes': {
      const text = String(display).trim()
      const n = Number(text)
      if (text === '' || !Number.isFinite(n) || n <= 0) {
        return { ok: false, error: 'Enter a size in MB, larger than zero.' }
      }
      return { ok: true, value: Math.round(n * BYTES_PER_MB) }
    }
    case 'text': {
      const text = String(display)
      if (text.trim() === '' && isNullableSetting(key)) return { ok: true, value: null }
      return { ok: true, value: text }
    }
    default:
      return { ok: false, error: 'This setting cannot be edited here.' }
  }
}

function same(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const initial = settings as unknown as Record<SettingKey, unknown>

  // `saved` is what the database holds. `draft` is what the boxes show.
  const [saved, setSaved] = React.useState<Record<string, unknown>>(() => ({ ...initial }))
  const [draft, setDraft] = React.useState<Record<string, DisplayValue>>(() => {
    const out: Record<string, DisplayValue> = {}
    for (const group of SETTING_GROUPS) {
      for (const key of group.keys) out[key] = toDisplay(key, initial[key])
    }
    return out
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [savingGroup, setSavingGroup] = React.useState<string | null>(null)

  function set(key: SettingKey, value: DisplayValue) {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev))
  }

  function isDirty(key: SettingKey) {
    const wire = toWire(key, draft[key])
    if (!wire.ok) return true
    return !same(wire.value, saved[key])
  }

  async function saveGroup(groupLabel: string, keys: SettingKey[]) {
    const dirty = keys.filter(isDirty)
    if (dirty.length === 0) return

    const updates: Record<string, unknown> = {}
    const localErrors: Record<string, string> = {}
    for (const key of dirty) {
      const wire = toWire(key, draft[key])
      if (!wire.ok) localErrors[key] = wire.error
      else updates[key] = wire.value
    }

    if (Object.keys(updates).length === 0) {
      setErrors((prev) => ({ ...prev, ...localErrors }))
      toast.error('Please fix the fields marked in red.')
      return
    }

    setSavingGroup(groupLabel)
    try {
      const result = await updateSettings(updates)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      const serverErrors = result.errors ?? {}
      const nextSaved = { ...saved }
      for (const key of Object.keys(updates)) {
        if (serverErrors[key]) continue
        nextSaved[key] = updates[key]
      }
      setSaved(nextSaved)
      setErrors((prev) => ({ ...prev, ...localErrors, ...serverErrors }))

      const problems = Object.keys(serverErrors).length + Object.keys(localErrors).length
      if (problems > 0) {
        toast.warning(
          `Saved ${result.changed.length} of ${dirty.length}. Check the fields marked in red.`,
        )
      } else if (result.changed.length === 0) {
        toast.info('Nothing changed.')
      } else {
        toast.success(
          result.changed.length === 1 ? 'Saved 1 setting.' : `Saved ${result.changed.length} settings.`,
        )
      }
    } finally {
      setSavingGroup(null)
    }
  }

  return (
    <Tabs defaultValue={SETTING_GROUPS[0].label}>
      <TabsList label="Setting groups">
        {SETTING_GROUPS.map((group) => {
          const count = group.keys.filter(isDirty).length
          return (
            <TabsTrigger key={group.label} value={group.label} count={count || undefined}>
              {group.label}
            </TabsTrigger>
          )
        })}
      </TabsList>

      {SETTING_GROUPS.map((group) => {
        const dirty = group.keys.filter(isDirty)
        const busy = savingGroup === group.label

        return (
          <TabsContent key={group.label} value={group.label}>
            <Card>
              <CardHeader bordered>
                <CardTitle>{group.label}</CardTitle>
                <CardDescription>{group.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 pt-6">
                {group.keys.map((key) => (
                  <Field
                    key={key}
                    settingKey={key}
                    value={draft[key]}
                    error={errors[key]}
                    dirty={isDirty(key)}
                    disabled={busy}
                    onChange={(v) => set(key, v)}
                  />
                ))}
              </CardContent>

              <CardFooter bordered className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {dirty.length === 0
                    ? 'No unsaved changes.'
                    : `Unsaved: ${dirty.map((k) => SETTING_LABELS[k]).join(', ')}`}
                </p>
                <Button
                  onClick={() => saveGroup(group.label, group.keys)}
                  disabled={dirty.length === 0 || busy}
                  loading={busy}
                  loadingText="Saving…"
                  leftIcon={<Save className="size-4" aria-hidden="true" />}
                >
                  {dirty.length === 0
                    ? 'Save changes'
                    : `Save ${dirty.length} ${dirty.length === 1 ? 'change' : 'changes'}`}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        )
      })}
    </Tabs>
  )
}

function Field({
  settingKey,
  value,
  error,
  dirty,
  disabled,
  onChange,
}: {
  settingKey: SettingKey
  value: DisplayValue
  error?: string
  dirty: boolean
  disabled?: boolean
  onChange: (value: DisplayValue) => void
}) {
  const kind = controlKindFor(settingKey)
  const label = SETTING_LABELS[settingKey]
  const hint = SETTING_HINTS[settingKey]
  const hintId = `${settingKey}-hint`
  const errorId = `${settingKey}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  const changedMark = dirty ? (
    <span className="ml-2 align-middle text-xs font-normal text-amber-600 dark:text-amber-400">
      unsaved
    </span>
  ) : null

  if (kind === 'boolean') {
    return (
      <div>
        <Checkbox
          id={settingKey}
          checked={Boolean(value)}
          disabled={disabled}
          aria-describedby={describedBy || undefined}
          label={
            <>
              {label}
              {changedMark}
            </>
          }
          description={hint}
          onChange={(e) => onChange(e.target.checked)}
        />
        {error && <FieldError id={errorId}>{error}</FieldError>}
      </div>
    )
  }

  if (kind === 'mimeTypes') {
    const picked = Array.isArray(value) ? (value as string[]) : []
    return (
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">
          {label}
          {changedMark}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {MIME_CHOICES.map((choice) => (
            <Checkbox
              key={choice.value}
              label={choice.label}
              checked={picked.includes(choice.value)}
              disabled={disabled}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...picked, choice.value]
                    : picked.filter((m) => m !== choice.value),
                )
              }
            />
          ))}
        </div>
        {hint && <FieldHint id={hintId}>{hint}</FieldHint>}
        {error && <FieldError id={errorId}>{error}</FieldError>}
      </fieldset>
    )
  }

  if (kind === 'pricing') {
    return (
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">
          {label}
          {changedMark}
        </p>
        <PricingEditor
          rows={(value as PriceRow[]) ?? []}
          disabled={disabled}
          onChange={(rows) => onChange(rows)}
        />
        {hint && <FieldHint id={hintId}>{hint}</FieldHint>}
        {error && <FieldError id={errorId}>{error}</FieldError>}
      </div>
    )
  }

  const isNumber = kind === 'number' || kind === 'megabytes'

  return (
    <div>
      <Label htmlFor={settingKey}>
        {kind === 'megabytes' ? 'Largest file (MB)' : label}
        {changedMark}
      </Label>
      <Input
        id={settingKey}
        className="mt-1.5 max-w-md"
        type={isNumber ? 'number' : 'text'}
        step={kind === 'megabytes' ? '0.1' : '1'}
        min={isNumber ? '0' : undefined}
        suffix={kind === 'megabytes' ? 'MB' : undefined}
        value={String(value ?? '')}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <FieldHint id={hintId}>{hint}</FieldHint>}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  )
}
