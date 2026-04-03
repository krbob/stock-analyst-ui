import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? 'dot' : 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
  },
});
