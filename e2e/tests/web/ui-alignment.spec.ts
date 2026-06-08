import { test, expect } from '../fixtures'
import path from 'path'
import fs from 'fs'

const artifactDir = path.resolve(__dirname, '../../artifacts/web')

test.describe('Web UI 对齐修复断言', () => {
  test.beforeAll(() => {
    fs.mkdirSync(artifactDir, { recursive: true })
  })

  test.use({ viewport: { width: 1440, height: 900 } })

  test('Sidebar 新建群聊按钮有 lucide 图标', async ({ authedPage: page }) => {
    await page.goto('/workspace/test-session')
    await page.waitForSelector('[data-testid="workspace-shell"]')
    const iconBtn = page.locator('[data-testid="new-group-conversation"] svg.lucide-plus')
    await expect(iconBtn.first()).toBeVisible()
  })

  test('Composer 工具条包含 @ 和附件图标', async ({ authedPage: page }) => {
    await page.goto('/workspace/test-session')
    await page.waitForSelector('[data-testid="message-composer"]')
    const atBtn = page.locator('[data-testid="message-composer"] [aria-label="提及 Agent"]')
    const attachBtn = page.locator('[data-testid="message-composer"] [aria-label="附件"]')
    await expect(atBtn).toBeVisible()
    await expect(attachBtn).toBeVisible()
  })

  test('Composer 发送按钮使用 IconButton', async ({ authedPage: page }) => {
    await page.goto('/workspace/test-session')
    await page.waitForSelector('[data-testid="message-composer"]')
    const sendBtn = page.locator('[data-testid="message-composer"] [aria-label="发送"]')
    await expect(sendBtn).toBeVisible()
  })

  test('ChatPanel 消息气泡使用语义 token', async ({ authedPage: page }) => {
    await page.goto('/workspace/test-session')
    await page.waitForSelector('[data-testid="chat-panel"]')
    const hardcodedColors = await page.evaluate(() => {
      const issues: string[] = []
      document.querySelectorAll('[data-testid="chat-panel"] [class]').forEach(el => {
        const cls = el.getAttribute('class') || ''
        if (/bg-blue-\d|bg-gray-\d|bg-green-\d|bg-yellow-\d/.test(cls)) {
          issues.push(cls)
        }
      })
      return issues
    })
    expect(hardcodedColors).toHaveLength(0)
  })

  test('截图留存 - Composer 工具条', async ({ authedPage: page }) => {
    await page.goto('/workspace/test-session')
    await page.waitForSelector('[data-testid="message-composer"]')
    const composer = page.locator('[data-testid="message-composer"]')
    await composer.screenshot({ path: path.join(artifactDir, 'composer-toolbar.png') })
  })
})
