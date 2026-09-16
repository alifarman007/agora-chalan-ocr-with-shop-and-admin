import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    /**
     * The OCR services are a byte-for-byte port of the client-approved agent
     * (agoraOCR @ b54ac32). Their `any` casts are part of that approved code, and a
     * unit test asserts the prompts' SHA-256 hashes. We relax the rule here rather
     * than edit the file, because changing approved logic needs the client's say-so.
     */
    files: ['src/server/ocr/geminiClient.ts', 'src/server/ocr/geminiService.ts', 'src/server/ocr/structureService.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'drizzle/**',
    '.storage/**',
  ]),
])

export default eslintConfig
