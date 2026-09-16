import { defineConfig } from 'vitest/config'
import path from 'node:path'

const dir = import.meta.dirname

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Integration tests share one database, so they must not run concurrently.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(dir, './src'),
      // `server-only` throws outside a React Server Component. In tests we are
      // deliberately calling server modules directly, so stub it out.
      'server-only': path.resolve(dir, './tests/stubs/server-only.ts'),
    },
  },
})
