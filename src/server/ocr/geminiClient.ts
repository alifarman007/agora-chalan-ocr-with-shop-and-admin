import 'server-only';
import { GoogleGenAI } from "@google/genai";

/**
 * Gemini API key pool with automatic failover.
 *
 * Up to four keys are read from the environment (GEMINI_API_KEY_1 … GEMINI_API_KEY_4,
 * plus the legacy single GEMINI_API_KEY as a final fallback slot). Every Gemini call
 * goes through withGeminiFailover(): it tries the active key and, on ANY API failure
 * (daily quota exhausted, per-minute rate limit, invalid key, server error, network
 * failure), silently moves to the next key in the pool. The caller only sees an error
 * if every configured key fails for the same request.
 *
 * The index of the last key that worked is remembered for the session, so once a key
 * dies traffic starts from a healthy key instead of re-failing on the dead one for
 * every call. A page reload resets the rotation back to key 1.
 *
 * PORT NOTE: in Next.js these are read from the server environment at RUNTIME.
 * They must never be prefixed NEXT_PUBLIC_, or the key would reach the browser —
 * which is exactly the flaw this port exists to fix.
 */
const KEY_SLOTS: Array<string | undefined> = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY, // legacy single-key setups keep working
];

// Drop empty slots and obvious template placeholders; de-duplicate pasted repeats.
const PLACEHOLDER_PATTERN = /your[-_ ]?api[-_ ]?key|_here$|placeholder/i;

const API_KEYS: string[] = [
  ...new Set(
    KEY_SLOTS
      .map((key) => (key ?? '').trim())
      .filter((key) => key.length > 0 && !PLACEHOLDER_PATTERN.test(key))
  ),
];

/** Thrown when no usable API key is configured (env vars missing at build time). */
export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "No Gemini API key configured. Set GEMINI_API_KEY_1 (…_4) in .env.local " +
      "(or in Vercel environment variables) and rebuild."
    );
    this.name = "MissingApiKeyError";
  }
}

// Index of the key that most recently succeeded (sticky for the session).
let activeKeyIndex = 0;

/**
 * Runs `task` against the Gemini SDK, transparently failing over across the key pool.
 * Each request tries every key at most once, starting from the last known-good key.
 *
 * Only errors thrown by the API call itself trigger failover — response-content
 * problems (empty text, malformed JSON) are handled by the caller, because a
 * different key would not change the model's answer.
 */
export async function withGeminiFailover<T>(
  task: (ai: GoogleGenAI) => Promise<T>
): Promise<T> {
  if (API_KEYS.length === 0) {
    throw new MissingApiKeyError();
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
    const index = (activeKeyIndex + attempt) % API_KEYS.length;
    // Fresh client per attempt — service calls stay stateless (see CLAUDE.md §9).
    const ai = new GoogleGenAI({ apiKey: API_KEYS[index] });
    try {
      const result = await task(ai);
      activeKeyIndex = index; // stick with the key that worked
      return result;
    } catch (error) {
      lastError = error;
      // Log the position in the pool only — never the key value.
      const hasNext = attempt < API_KEYS.length - 1;
      console.warn(
        `Gemini API key ${index + 1}/${API_KEYS.length} failed` +
        (hasNext ? ", switching to the next key…" : " — no keys left for this request."),
        error
      );
    }
  }
  throw lastError;
}
