import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/desktop',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
})
