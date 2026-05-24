import { test as base, type Page } from '@playwright/test'

const sessionPayload = JSON.stringify({
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: {
    id: 'test-user-001',
    email: 'test@agenthub.dev',
    app_metadata: { provider: 'github' },
    user_metadata: { full_name: 'Test User' },
    aud: 'authenticated',
    role: 'authenticated',
  },
})

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page, context }, use) => {
    // sb-{hostname.split('.')[0]}-auth-token → sb-localhost-auth-token
    await context.addCookies([
      {
        name: 'sb-localhost-auth-token',
        value: sessionPayload,
        domain: 'localhost',
        path: '/',
      },
    ])
    await use(page)
  },
})

export { expect } from '@playwright/test'
