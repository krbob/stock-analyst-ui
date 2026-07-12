/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

interface CoverageBaseline {
  include: string[]
  exclude: string[]
  thresholds: {
    statements: number
    branches: number
    functions: number
    lines: number
  }
}

const coverageBaseline = JSON.parse(
  readFileSync(new URL('./coverage-baseline.json', import.meta.url), 'utf8'),
) as CoverageBaseline

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: coverageBaseline.include,
      exclude: coverageBaseline.exclude,
      reporter: ['text', 'json-summary', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      reportOnFailure: true,
      thresholds: {
        ...coverageBaseline.thresholds,
        autoUpdate: false,
      },
    },
  },
})
