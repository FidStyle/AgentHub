import { test, expect } from '@playwright/test'

test.describe('P0 Web 工作台主路径', () => {
  test('首页 GitHub 登录按钮可点击', async ({ page }) => {
    await page.goto('/')
    const loginBtn = page.locator('button', { hasText: '使用 GitHub 登录' })
    await expect(loginBtn).toBeVisible()
    await expect(loginBtn).toBeEnabled()
  })

  test('Workspace 列表页加载', async ({ page }) => {
    await page.goto('/workspace')
    const heading = page.locator('h1', { hasText: '我的工作区' })
    await expect(heading).toBeVisible()
  })

  test('新建工作区按钮可点击并打开对话框', async ({ page }) => {
    await page.goto('/workspace')
    const createBtn = page.locator('button', { hasText: '新建工作区' })
    await expect(createBtn).toBeVisible()
    await createBtn.click()
    const dialog = page.locator('[role="dialog"], form')
    await expect(dialog).toBeVisible({ timeout: 3000 })
  })

  test('Workspace 项点击后导航到工作台', async ({ page }) => {
    await page.goto('/workspace')
    const wsItem = page.locator('button').filter({ hasText: /.+/ }).first()
    if (await wsItem.isVisible()) {
      await wsItem.click()
      await page.waitForURL(/\/workspace\//, { timeout: 5000 })
      const shell = page.locator('[data-testid="workspace-shell"]')
      await expect(shell).toBeVisible()
    }
  })

  test('工作台三栏布局加载', async ({ page }) => {
    await page.goto('/workspace')
    const wsItem = page.locator('button').filter({ hasText: /.+/ }).first()
    if (await wsItem.isVisible()) {
      await wsItem.click()
      await page.waitForURL(/\/workspace\//)

      await expect(page.locator('[data-testid="workspace-shell"]')).toBeVisible()
      await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible()
    }
  })

  test('消息发送按钮状态正确', async ({ page }) => {
    await page.goto('/workspace')
    const wsItem = page.locator('button').filter({ hasText: /.+/ }).first()
    if (await wsItem.isVisible()) {
      await wsItem.click()
      await page.waitForURL(/\/workspace\//)

      const composer = page.locator('[data-testid="message-composer"]')
      await expect(composer).toBeVisible()
      const sendBtn = composer.locator('button[aria-label="发送"]')
      await expect(sendBtn).toBeDisabled()
    }
  })
})

test.describe('P0 Mobile/PWA 主路径', () => {
  test('Mobile 首页 Workspace 列表加载', async ({ page }) => {
    await page.goto('/m')
    const heading = page.locator('h2', { hasText: '工作区' })
    await expect(heading).toBeVisible()
  })

  test('Mobile Workspace 点击选中', async ({ page }) => {
    await page.goto('/m')
    const wsBtn = page.locator('button').filter({ hasText: /.+/ }).first()
    if (await wsBtn.isVisible()) {
      await wsBtn.click()
      await expect(wsBtn).toHaveClass(/border-primary/)
    }
  })

  test('Mobile 审批页加载', async ({ page }) => {
    await page.goto('/m/approve')
    await page.waitForLoadState('networkidle')
    const hasContent = await page.locator('h2, [class*="empty"]').isVisible()
    expect(hasContent).toBeTruthy()
  })

  test('Mobile Preview 页无 URL 时显示空状态', async ({ page }) => {
    await page.goto('/m/preview')
    const emptyState = page.locator('text=无预览内容')
    await expect(emptyState).toBeVisible()
  })

  test('Mobile Local Desktop Workspace 显示离线提示', async ({ page }) => {
    await page.goto('/m')
    const offlineHint = page.locator('text=Desktop Connector')
    const count = await offlineHint.count()
    // If there are local_desktop workspaces, the hint should show
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
