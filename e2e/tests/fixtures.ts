import { test as base, type Page } from '@playwright/test'
import { ensureP0StorageState } from '../helpers/auth-state'

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ browser }, use) => {
    const storageState = await ensureP0StorageState()
    const context = await browser.newContext({ storageState })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

export { expect } from '@playwright/test'
