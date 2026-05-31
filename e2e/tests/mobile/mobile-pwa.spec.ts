import { test, expect } from '../fixtures'

test.describe('Mobile/PWA 轻量界面 (M14)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto('/m')
    await page.waitForLoadState('networkidle')
  })

  test('mobile-session 定位点存在', async ({ authedPage: page }) => {
    const container = page.locator('[data-testid="mobile-session"]')
    await expect(container).toBeVisible()
  })

  test('390x844 下无横向滚动', async ({ authedPage: page }) => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  test('工作区列表页显示中文 UI', async ({ authedPage: page }) => {
    await expect(page.getByRole('heading', { name: '工作区' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'AgentHub' })).toBeVisible()
  })

  test('审批页面可导航', async ({ authedPage: page }) => {
    await page.request.get('/m/approve')
    await page.goto('/m/approve')
    await expect(page.getByText('远程监督与授权').or(page.getByText('暂无需要授权的动作'))).toBeVisible()
    await page.goto('/m')
    await page.getByRole('link', { name: '授权' }).click()
    await expect(page).toHaveURL(/\/m\/approve$/)
    await expect(page.getByText('远程监督与授权').or(page.getByText('暂无需要授权的动作'))).toBeVisible()
  })
})
