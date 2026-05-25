import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/desktop/**'],
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'web-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testMatch: ['web/**', 'web-workbench.spec.ts', 'design-system.spec.ts', 'workspace.spec.ts'],
    },
    {
      name: 'web-tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } },
      testMatch: ['web/**'],
    },
    {
      name: 'mobile-pwa',
      use: { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } },
      testMatch: ['mobile/**'],
    },
  ],
})
