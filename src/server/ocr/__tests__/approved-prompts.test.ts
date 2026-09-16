/**
 * The guard rail on the client-approved OCR agent.
 *
 * The client approved commit b54ac32 of agoraOCR. These two prompts ARE the approved
 * behaviour. If this test fails, someone changed the agent's logic — deliberately or
 * by accident (a CRLF checkout is enough to do it silently).
 *
 * Do not "fix" this test by updating the hashes. Ask Alif first.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = path.join(process.cwd(), 'src/server/ocr')

function sha256(text: string) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function extract(file: string, pattern: RegExp) {
  const source = readFileSync(path.join(dir, file), 'utf8')
  const match = source.match(pattern)
  if (!match) throw new Error(`Could not find the prompt in ${file}`)
  return match[1]
}

describe('approved OCR agent', () => {
  it('OCR system prompt is byte-for-byte the approved one', () => {
    const prompt = extract('geminiService.ts', /const systemInstruction = `([\s\S]*?)`;/)
    expect(Buffer.byteLength(prompt, 'utf8')).toBe(1138)
    expect(sha256(prompt)).toBe(
      'a56c92ab33ec109b4a4a01ad9879f548a0b1c3a58bd30a34af9651597083300e',
    )
  })

  it('delivery chalan structuring prompt is byte-for-byte the approved one', () => {
    const prompt = extract(
      'structureService.ts',
      /const DELIVERY_CHALAN_STRUCTURE_PROMPT = `([\s\S]*?)`;/,
    )
    expect(Buffer.byteLength(prompt, 'utf8')).toBe(3465)
    expect(sha256(prompt)).toBe(
      '4558824e505230abd85dd664f23cadf0726d76e3d2189e39699c35daf0be76c2',
    )
  })

  it('the OCR user text is unchanged', () => {
    const source = readFileSync(path.join(dir, 'geminiService.ts'), 'utf8')
    expect(source).toContain(
      'Perform OCR on this document. Preserve layout and Bangla/English text exactly as it appears.',
    )
  })

  it('model settings are unchanged: temperature 0.1 on both calls, JSON mode on the second', () => {
    const ocr = readFileSync(path.join(dir, 'geminiService.ts'), 'utf8')
    const structure = readFileSync(path.join(dir, 'structureService.ts'), 'utf8')
    expect(ocr).toContain('temperature: 0.1')
    expect(structure).toContain('temperature: 0.1')
    expect(structure).toContain('responseMimeType: "application/json"')
  })

  it('structuring still runs on the OCR text, never on the image', () => {
    const structure = readFileSync(path.join(dir, 'structureService.ts'), 'utf8')
    expect(structure).toContain('parts: [{ text: rawOcrText }]')
    expect(structure).not.toContain('inlineData')
  })

  it('no source file carries Windows line endings, which would change the prompts', () => {
    for (const file of ['geminiService.ts', 'structureService.ts', 'geminiClient.ts']) {
      const bytes = readFileSync(path.join(dir, file))
      expect(bytes.filter((b) => b === 13).length, `${file} contains CR bytes`).toBe(0)
    }
  })

  it('the Gemini key is never exposed to the browser', () => {
    const client = readFileSync(path.join(dir, 'geminiClient.ts'), 'utf8')
    expect(client).toContain("import 'server-only'")
    // A comment may mention the prefix; what matters is that no code READS one.
    expect(client).not.toMatch(/process\.env\.NEXT_PUBLIC_/)
    expect(client).toContain('process.env.GEMINI_API_KEY_1')
  })
})
