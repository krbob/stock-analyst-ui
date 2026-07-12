/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
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

function offlineAssetManifest(): Plugin {
  return {
    name: 'offline-asset-manifest',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle)
        .filter((fileName) => fileName.startsWith('assets/'))
        .sort()
        .map((fileName) => `/${fileName}`)

      this.emitFile({
        type: 'asset',
        fileName: 'asset-manifest.json',
        source: `${JSON.stringify({ version: 1, assets }, null, 2)}\n`,
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), offlineAssetManifest()],
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
