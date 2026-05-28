import { test, expect } from '@playwright/test'
import { ensureP0StorageState } from '../../helpers/auth-state'
import { assertNoHorizontalScroll } from '../../helpers/visual-assertions'

test.describe('P0 Mobile /m/* 鉴权', () => {
  test('未登录 /m 重定向到首页', async ({ page }) => {
    await page.goto('/m')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL('/')
  })

  test('登录后 /m 可正常访问', async ({ browser }) => {
    const storageState = await ensureP0StorageState()
    const context = await browser.newContext({ storageState })
    const page = await context.newPage()
    await page.goto('/m')
    await page.waitForLoadState('networkidle')

    // 不应被重定向
    expect(page.url()).toContain('/m')

    // 视觉断言
    await assertNoHorizontalScroll(page)

    await context.close()
  })
})
