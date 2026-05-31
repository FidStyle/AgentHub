import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

const desktopRoot = path.resolve(__dirname, '../../../apps/desktop')
let viteProcess: ChildProcess
let electronApp: ElectronApplication
let window: Page

test.describe('P0 入口点击语义验证', () => {
  test.beforeAll(async () => {
    viteProcess = spawn('npx', ['vite', '--port', '5177'], {
      cwd: desktopRoot,
      stdio: 'pipe',
    })

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Vite startup timeout')), 15000)
      const onData = (data: Buffer) => {
        if (data.toString().includes('ready') || data.toString().includes('Local')) {
          clearTimeout(timeout)
          resolve()
        }
      }
      viteProcess.stdout?.on('data', onData)
      viteProcess.stderr?.on('data', onData)
    })

    electronApp = await electron.launch({
      args: [path.join(desktopRoot, 'dist/main/main/index.js')],
      env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5177' },
    })
    window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')
  })

  test.afterAll(async () => {
    await electronApp?.close()
    viteProcess?.kill()
  })

  test('GitHub 登录按钮点击后触发可观察结果', async () => {
    const sidebar = window.locator('[data-testid="desktop-session-sidebar"]')
    const loginBtn = sidebar.locator('[data-auth-action="github-login"]')
    await expect(loginBtn).toBeVisible()

    const popupPromise = window.waitForEvent('popup', { timeout: 5000 }).catch(() => null)
    await loginBtn.click()

    const popup = await popupPromise
    if (popup) {
      expect(popup.url()).toContain('auth')
      await popup.close()
    } else {
      const errorMsg = sidebar.locator('.text-destructive')
      await expect(errorMsg).toBeVisible({ timeout: 3000 })
      const text = await errorMsg.textContent()
      expect(text).toBeTruthy()
      expect(text!.length).toBeGreaterThan(0)
    }
  })

  test('设置页 GitHub 登录按钮点击有反馈', async () => {
    await window.locator('[data-testid="desktop-nav-settings"]').click()
    await expect(window.locator('[data-testid="desktop-settings-page"]')).toBeVisible()

    const loginBtn = window.locator('[data-testid="desktop-settings-item-account"] [data-auth-action="github-login"]')
    await expect(loginBtn).toBeVisible()

    const popupPromise = window.waitForEvent('popup', { timeout: 5000 }).catch(() => null)
    await loginBtn.click()

    const popup = await popupPromise
    if (popup) {
      await popup.close()
    } else {
      const errorMsg = window.locator('[data-testid="desktop-settings-item-account"] .text-destructive')
      await expect(errorMsg).toBeVisible({ timeout: 3000 })
    }
  })

  test('打开 Web 工作台按钮点击有反馈', async () => {
    await window.locator('[data-testid="desktop-nav-settings"]').click()
    const wsCard = window.locator('[data-testid="desktop-settings-item-workspace"]')
    const openBtn = wsCard.locator('button', { hasText: '打开 Web 工作台' })
    await expect(openBtn).toBeVisible()

    const popupPromise = window.waitForEvent('popup', { timeout: 5000 }).catch(() => null)
    await openBtn.click()

    const popup = await popupPromise
    if (popup) {
      await popup.close()
    } else {
      const errorEl = wsCard.locator('[data-testid="web-workspace-error"]')
      await expect(errorEl).toBeVisible({ timeout: 3000 })
    }
  })

  test('Agent 选择按钮点击后进入会话', async () => {
    await window.locator('[data-testid="desktop-nav-workspace"]').click()
    const session = window.locator('[data-testid="desktop-agent-session"]')
    await expect(session).toBeVisible()

    const agentBtn = session.locator('button', { hasText: 'Codex' })
    if (await agentBtn.isVisible()) {
      await agentBtn.click()
      const badge = window.locator('[data-testid="desktop-selected-agent"]')
      await expect(badge).toBeVisible({ timeout: 2000 })
      await expect(badge).toHaveText('Codex')
    }
  })

  test('Composer 无 Agent 时显示提示且按钮 disabled', async () => {
    const composer = window.locator('[data-testid="desktop-agent-composer"]')
    await expect(composer).toBeVisible()

    const sendBtn = composer.locator('button', { hasText: '发送' })
    await expect(sendBtn).toBeDisabled()
  })

  test('导航按钮全部可点击且切换页面', async () => {
    const navItems = [
      { testId: 'desktop-nav-workspace', page: 'desktop-agent-session' },
      { testId: 'desktop-nav-sessions', page: 'desktop-sessions-page' },
      { testId: 'desktop-nav-agents', page: 'desktop-agent-config-page' },
      { testId: 'desktop-nav-policy', page: 'desktop-policy-page' },
      { testId: 'desktop-nav-settings', page: 'desktop-settings-page' },
    ]

    for (const { testId, page } of navItems) {
      await window.locator(`[data-testid="${testId}"]`).click()
      await expect(window.locator(`[data-testid="${page}"]`)).toBeVisible({ timeout: 2000 })
    }
  })

  test('本机策略页权限预设切换按钮可点击', async () => {
    await window.locator('[data-testid="desktop-nav-policy"]').click()
    const page = window.locator('[data-testid="desktop-policy-page"]')
    await expect(page).toBeVisible()

    const switchBtn = page.locator('button', { hasText: '切换' }).first()
    if (await switchBtn.isVisible()) {
      await expect(switchBtn).toBeEnabled()
      await switchBtn.click()
    }
  })

  test('Workspace item 点击后选中状态变化', async () => {
    await window.locator('[data-testid="desktop-nav-workspace"]').click()
    const wsItem = window.locator('[data-testid="desktop-workspace-item-0"]')
    if (await wsItem.isVisible()) {
      await wsItem.click()
      await expect(wsItem).toHaveAttribute('data-state', 'active')
    }
  })
})
