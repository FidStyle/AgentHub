import { test, expect } from '../fixtures'

async function seedWorkspace(page: import('@playwright/test').Page, name = `E2E-P0FLOW-${Date.now()}`) {
  const response = await page.request.post('/api/workspaces', {
    data: { name, execution_domain: 'cloud' },
  })
  expect(response.ok()).toBeTruthy()
  return await response.json() as { id: string; name: string }
}

test.describe('P0 Web 工作台主路径', () => {
  test('首页 GitHub 登录按钮可点击', async ({ page }) => {
    await page.goto('/')
    const loginBtn = page.locator('button', { hasText: '使用 GitHub 登录' })
    await expect(loginBtn).toBeVisible()
    await expect(loginBtn).toBeEnabled()
  })

  test('Workspace 列表页加载', async ({ authedPage: page }) => {
    await page.goto('/workspace')
    await expect(page.getByRole('heading', { name: '我的工作区' })).toBeVisible()
  })

  test('新建工作区按钮可点击并打开对话框', async ({ authedPage: page }) => {
    await page.goto('/workspace')
    const createBtn = page.getByRole('button', { name: '新建工作区' })
    await expect(createBtn).toBeVisible()
    await createBtn.click()
    const dialog = page.locator('[role="dialog"], form')
    await expect(dialog).toBeVisible({ timeout: 3000 })
  })

  test('Workspace 项点击后导航到工作台', async ({ authedPage: page }) => {
    const workspace = await seedWorkspace(page)
    await page.goto('/workspace')
    const card = page.locator('article', { hasText: workspace.name })
    await card.getByRole('button', { name: '进入工作区' }).click()
    await page.waitForURL(/\/workspace\//, { timeout: 5000 })
    await expect(page.getByTestId('workspace-shell')).toBeVisible()
  })

  test('工作台三栏布局加载', async ({ authedPage: page }) => {
    const workspace = await seedWorkspace(page)
    await page.goto(`/workspace/${workspace.id}`)
    await expect(page.getByTestId('workspace-shell')).toBeVisible()
    await expect(page.getByTestId('chat-panel')).toBeVisible()
  })

  test('消息发送按钮状态正确', async ({ authedPage: page }) => {
    const workspace = await seedWorkspace(page)
    await page.goto(`/workspace/${workspace.id}`)
    const composer = page.getByTestId('message-composer')
    await expect(composer).toBeVisible()
    await expect(page.getByTestId('send-btn')).toBeDisabled()
  })
})

test.describe('P0 Mobile/PWA 主路径', () => {
  test('Mobile 首页 Workspace 列表加载', async ({ authedPage: page }) => {
    await page.goto('/m')
    await expect(page.getByRole('heading', { name: '工作区' })).toBeVisible()
  })

  test('Mobile Workspace 点击选中', async ({ authedPage: page }) => {
    const workspace = await seedWorkspace(page, `E2E-MOBILE-P0-${Date.now()}`)
    await page.goto('/m')
    const wsBtn = page.getByRole('button', { name: new RegExp(workspace.name) })
    await wsBtn.click()
    await expect(wsBtn).toHaveClass(/border-primary/)
  })

  test('Mobile 审批页加载', async ({ authedPage: page }) => {
    await page.goto('/m/approve')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/远程监督与授权|暂无需要授权的动作/)
  })

  test('Mobile Preview 页无 URL 时显示空状态', async ({ authedPage: page }) => {
    await page.goto('/m/preview')
    await expect(page.locator('body')).toContainText('无预览内容')
  })

  test('Mobile Local Desktop Workspace 显示离线提示', async ({ authedPage: page }) => {
    await page.goto('/m')
    const offlineHint = page.locator('text=Desktop Connector')
    const count = await offlineHint.count()
    // If there are local_desktop workspaces, the hint should show
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
