'use client'

import { useState } from 'react'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { Button, FieldHint, Input, Label, toast } from '@/components/ui'

/** No 0/O or 1/l/I, so nobody mistypes it off a sticky note. */
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

export function generatePassword(): string {
  const numbers = new Uint32Array(15)
  crypto.getRandomValues(numbers)
  const raw = Array.from(numbers, (value) => CHARS[value % CHARS.length]).join('')
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}`
}

export function TemporaryPasswordField({
  id,
  value,
  onChange,
  label = 'Temporary password',
}: {
  id: string
  value: string
  onChange: (value: string) => void
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success('Password copied.')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy. Select the text and copy it by hand.')
    }
  }

  return (
    <div>
      <Label htmlFor={id} required>
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          className="font-mono"
          containerClassName="flex-1"
          autoComplete="off"
          spellCheck={false}
          minLength={8}
          maxLength={128}
          required
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Make a new password"
          onClick={() => onChange(generatePassword())}
        >
          <RefreshCw className="size-4" />
        </Button>
        <Button variant="outline" size="icon" aria-label="Copy password" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
      <FieldHint>
        Give this password to the person by hand. They must change it the first time they
        sign in. It is never shown again.
      </FieldHint>
    </div>
  )
}
