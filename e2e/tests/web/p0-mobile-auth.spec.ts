import { test, expect } from '@playwright/test'
import { ensureAcceptanceStorageState } from '../../helpers/auth-state'
import { assertNoHorizontalScroll } from '../../helpers/visual-assertions'

test.describe('P0 Mobile /m/* 鉴权', () => {
  test('未登录 /m 重定向到移动登录页', async ({ page }) => {
    await page.goto('/m')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/m\/login\?callbackUrl=%2Fm$/)
    await expect(page.getByTestId('mobile-login')).toBeVisible()
    await expect(page.getByRole('heading', { name: '移动端登录' })).toBeVisible()
  })

  test('未登录移动深链保留 callbackUrl', async ({ page }) => {
    await page.goto('/m/approve')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/m\/login\?callbackUrl=%2Fm%2Fapprove$/)
  })

  test('登录后 /m 可正常访问', async ({ browser }) => {
    const storageState = await ensureAcceptanceStorageState()
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
