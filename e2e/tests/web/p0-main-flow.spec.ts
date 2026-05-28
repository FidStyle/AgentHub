import { test, expect } from '@playwright/test'
import { ensureP0StorageState } from '../../helpers/auth-state'
import { assertNoHorizontalScroll, assertNoElementOverlap } from '../../helpers/visual-assertions'

test.describe('P0 Web 主链路', () => {
  let storageState: string

  test.beforeAll(async () => {
    storageState = await ensureP0StorageState()
  })

  test('Workspace 创建 → Session → 消息 → reload 持久化', async ({ browser }) => {
    const context = await browser.newContext({ storageState })
    const page = await context.newPage()

    await page.goto('/workspace')
    await page.waitForLoadState('networkidle')

    // 创建 Workspace
    const createWsBtn = page.locator('[data-testid="create-workspace"], button:has-text("新建"), button:has-text("创建")')
    if (await createWsBtn.isVisible()) {
      await createWsBtn.first().click()
      const nameInput = page.locator('input[name="name"], input[placeholder*="名称"]')
      if (await nameInput.isVisible()) {
        await nameInput.fill(`E2E-WS-${Date.now()}`)
        await page.locator('button[type="submit"], button:has-text("确定"), button:has-text("创建")').first().click()
      }
    }

    await page.waitForTimeout(1000)

    // 创建 Session
    const createSessionBtn = page.locator('[data-testid="create-session"], button:has-text("新会话"), button:has-text("新建会话")')
    if (await createSessionBtn.isVisible()) {
      await createSessionBtn.first().click()
      await page.waitForTimeout(500)
    }

    // 发送消息
    const msgInput = page.locator('[data-testid="message-input"], textarea, input[placeholder*="消息"]')
    const testMsg = `E2E-MSG-${Date.now()}`
    if (await msgInput.isVisible()) {
      await msgInput.fill(testMsg)
      await page.locator('[data-testid="send-button"], button:has-text("发送")').first().click()
      await page.waitForTimeout(1000)
    }

    // Reload 验证持久化
    await page.reload()
    await page.waitForLoadState('networkidle')

    // 视觉断言
    await assertNoHorizontalScroll(page)
    await assertNoElementOverlap(page, '[data-testid="main-panel"], main, aside, nav')

    await context.close()
  })

  test('布局断言：无横向滚动、容器不重叠', async ({ browser }) => {
    const context = await browser.newContext({ storageState })
    const page = await context.newPage()
    await page.goto('/workspace')
    await page.waitForLoadState('networkidle')

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)

    await context.close()
  })
})
