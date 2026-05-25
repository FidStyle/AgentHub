import { test, expect } from './fixtures'
import { assertNoHorizontalScroll } from '../helpers/visual-assertions'

test.describe('Web 三栏工作台', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto('/workspace/test-workspace')
    await page.waitForSelector('[data-testid="workspace-shell"]')
  })

  test('三栏布局渲染正确', async ({ authedPage: page }) => {
    await expect(page.getByTestId('workspace-shell')).toBeVisible()
    await expect(page.getByTestId('session-list')).toBeVisible()
    await expect(page.getByTestId('chat-panel')).toBeVisible()
    await expect(page.getByTestId('artifact-panel')).toBeVisible()
    await assertNoHorizontalScroll(page)
  })

  test('消息输入框可交互', async ({ authedPage: page }) => {
    const sessionList = page.getByTestId('session-list')
    const firstSession = sessionList.locator('button').first()
    await firstSession.click()
    const composer = page.getByTestId('message-composer')
    await expect(composer).toBeVisible()
    const input = composer.locator('input')
    await input.fill('测试消息')
    await expect(input).toHaveValue('测试消息')
  })

  test('会话切换更新聊天面板', async ({ authedPage: page }) => {
    const sessionList = page.getByTestId('session-list')
    const firstSession = sessionList.locator('button').first()
    await firstSession.click()
    const chatPanel = page.getByTestId('chat-panel')
    await expect(chatPanel).toContainText('项目架构讨论')
  })

  test('右栏可折叠', async ({ authedPage: page }) => {
    await expect(page.getByTestId('artifact-panel')).toBeVisible()
    const closeBtn = page.getByTestId('artifact-panel').getByText('关闭')
    await closeBtn.click()
    await expect(page.getByTestId('artifact-panel')).not.toBeVisible()
  })
})
