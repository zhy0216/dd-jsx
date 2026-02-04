import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'examples/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      'dd-jsx/jsx-runtime': resolve(__dirname, 'src/jsx/jsx-runtime.ts'),
      'dd-jsx/jsx-dev-runtime': resolve(__dirname, 'src/jsx/jsx-runtime.ts'),
      'dd-jsx': resolve(__dirname, 'src/index.ts'),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'dd-jsx',
  },
})
