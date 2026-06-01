import { test as base, type Page } from '@playwright/test'
import { ensureAcceptanceStorageState } from '../helpers/auth-state'

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ browser }, use) => {
    const storageState = await ensureAcceptanceStorageState()
    const context = await browser.newContext({ storageState })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

export { expect } from '@playwright/test'
