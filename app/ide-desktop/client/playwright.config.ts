/** @file Playwright browser testing configuration. */
import { defineConfig } from '@playwright/test'

const isCI = process.env.CI === 'true'

export default defineConfig({
  testDir: './tests',
  forbidOnly: isCI,
  retries: isCI ? 5 : 0,
  workers: 1,
  timeout: 120000,
  reportSlowTests: { max: 5, threshold: 60000 },
  globalSetup: './tests/setup.ts',
  expect: {
    timeout: 5000,
    toHaveScreenshot: { threshold: 0 },
  },
  use: {
    actionTimeout: 5000,
  },
})
