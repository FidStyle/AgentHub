import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

const desktopRoot = path.resolve(__dirname, '../../../apps/desktop')
let viteProcess: ChildProcess
let electronApp: ElectronApplication
let window: Page

test.describe('Desktop 主壳三栏布局', () => {
  test.beforeAll(async () => {
    viteProcess = spawn('npx', ['vite', '--port', '5176'], {
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
      cwd: desktopRoot,
      env: { ...process.env, NODE_ENV: 'development', VITE_PORT: '5176' },
    })

    window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')
  })

  test.afterAll(async () => {
    await electronApp?.close()
    viteProcess?.kill('SIGTERM')
  })

  test('启动后显示 desktop-main-shell', async () => {
    const shell = window.locator('[data-testid="desktop-main-shell"]')
    await expect(shell).toBeVisible({ timeout: 10000 })
  })

  test('显示 desktop-session-sidebar', async () => {
    const sidebar = window.locator('[data-testid="desktop-session-sidebar"]')
    await expect(sidebar).toBeVisible()
  })

  test('显示 desktop-agent-session 主区', async () => {
    const session = window.locator('[data-testid="desktop-agent-session"]')
    await expect(session).toBeVisible()
  })

  test('显示 desktop-agent-config 配置中心', async () => {
    const config = window.locator('[data-testid="desktop-agent-config"]')
    await expect(config).toBeVisible()
  })

  test('左侧导航可以进入独立 Agent 配置页', async () => {
    await window.locator('[data-testid="desktop-nav-agents"]').click()
    await expect(window.locator('[data-testid="desktop-agent-config-page"]')).toBeVisible()
    await expect(window.locator('[data-testid="desktop-nav-agents"]')).toHaveAttribute('aria-current', 'page')
  })

  test('独立 Agent 配置页显示 Codex 和 Claude Code 为已接入', async () => {
    await window.locator('[data-testid="desktop-nav-agents"]').click()
    const config = window.locator('[data-testid="desktop-agent-config-page"]')
    await expect(config.locator('[data-runtime="codex"]')).toBeVisible()
    await expect(config.locator('[data-runtime="claude_code"]')).toBeVisible()
    await expect(config.locator('[data-status="connected"]')).toHaveCount(2)
  })

  test('独立 Agent 配置页显示 OpenCode 为待接入且不可执行', async () => {
    await window.locator('[data-testid="desktop-nav-agents"]').click()
    const config = window.locator('[data-testid="desktop-agent-config-page"]')
    await expect(config.getByText('OpenCode')).toBeVisible()
    const openCodeCard = config.locator('[data-runtime="opencode"]')
    await expect(openCodeCard.locator('[data-status="pending"]')).toBeVisible()
    const actionBtn = openCodeCard.locator('button:has-text("进入会话")')
    await expect(actionBtn).toHaveCount(0)
  })

  test('从已接入 Agent 卡片可以进入本地轻量会话', async () => {
    await window.locator('[data-testid="desktop-nav-agents"]').click()
    const claudeCard = window.locator('[data-testid="desktop-agent-config-page"] [data-runtime="claude_code"]')
    await claudeCard.getByRole('button', { name: '进入会话' }).click()
    await expect(window.locator('[data-testid="desktop-agent-session"]')).toBeVisible()
    await expect(window.locator('[data-testid="desktop-selected-agent"]')).toContainText('Claude Code')
    await expect(window.locator('[data-testid="desktop-nav-workspace"]')).toHaveAttribute('aria-current', 'page')
  })

  test('左侧导航可以进入待审批和设置页面', async () => {
    await window.locator('[data-testid="desktop-nav-approvals"]').click()
    await expect(window.locator('[data-testid="desktop-approvals-page"]')).toBeVisible()
    await expect(window.locator('[data-testid="desktop-nav-approvals"]')).toHaveAttribute('aria-current', 'page')

    await window.locator('[data-testid="desktop-nav-settings"]').click()
    await expect(window.locator('[data-testid="desktop-settings-page"]')).toBeVisible()
    await expect(window.locator('[data-testid="desktop-nav-settings"]')).toHaveAttribute('aria-current', 'page')
  })

  test('敏感字段断言：不存在 API Key / ANTHROPIC_API_KEY / OPENAI_API_KEY / Base URL', async () => {
    const body = await window.locator('body').textContent()
    expect(body).not.toContain('API Key')
    expect(body).not.toContain('ANTHROPIC_API_KEY')
    expect(body).not.toContain('OPENAI_API_KEY')
    expect(body).not.toContain('Base URL')
  })

  test('普通展示文本禁止选中复制', async () => {
    await window.locator('[data-testid="desktop-nav-workspace"]').click()
    const shell = window.locator('[data-testid="desktop-main-shell"]')
    await expect(shell).toBeVisible()

    const box = await shell.boundingBox()
    expect(box).not.toBeNull()

    await window.mouse.move(box!.x + 24, box!.y + 80)
    await window.mouse.down()
    await window.mouse.move(box!.x + 360, box!.y + 220, { steps: 8 })
    await window.mouse.up()

    const selectedText = await window.evaluate(() => window.getSelection()?.toString() ?? '')
    expect(selectedText.trim()).toBe('')
  })

  test('所有登录入口统一到 GitHub 登录动作', async () => {
    const loginEntrypoints = window.locator('[data-auth-action="github-login"]')
    await expect(loginEntrypoints.first()).toBeVisible()

    const count = await loginEntrypoints.count()
    expect(count).toBeGreaterThanOrEqual(1)

    for (let i = 0; i < count; i += 1) {
      await expect(loginEntrypoints.nth(i)).toHaveAttribute('data-auth-action', 'github-login')
    }
  })

  test('主要按钮必须有交互反馈，待接入按钮不可执行', async () => {
    await window.locator('[data-testid="desktop-nav-agents"]').click()
    await expect(window.locator('[data-testid="desktop-agent-config-page"]')).toBeVisible()

    await window.locator('[data-testid="desktop-nav-settings"]').click()
    await expect(window.locator('[data-testid="desktop-settings-page"]')).toBeVisible()

    await window.locator('[data-testid="desktop-nav-agents"]').click()
    const openCodeCard = window.locator('[data-testid="desktop-agent-config-page"] [data-runtime="opencode"]')
    await expect(openCodeCard).toBeVisible()
    await expect(openCodeCard.getByRole('button', { name: /待接入|进入会话/ })).toBeDisabled()
  })

  test('入口、项目、会话、Agent 卡和设置项必须可点击或明确不可用', async () => {
    await window.locator('[data-testid="desktop-nav-workspace"]').click()
    const workspaceItems = window.locator('[data-testid^="desktop-workspace-item-"]')
    const workspaceCount = await workspaceItems.count()
    expect(workspaceCount).toBeGreaterThanOrEqual(1)

    await workspaceItems.first().click()
    await expect(workspaceItems.first()).toHaveAttribute('data-state', 'active')

    await window.locator('[data-testid="desktop-nav-sessions"]').click()
    await expect(window.locator('[data-testid="desktop-session-item"], [data-testid="desktop-empty-sessions"]')).toBeVisible()

    await window.locator('[data-testid="desktop-nav-agents"]').click()
    const codexCard = window.locator('[data-testid="desktop-agent-config-page"] [data-runtime="codex"]')
    await expect(codexCard).toBeVisible()
    await expect(codexCard.getByRole('button', { name: '进入会话' })).toBeEnabled()

    const pendingRuntime = window.locator('[data-testid="desktop-agent-config-page"] [data-runtime="opencode"]')
    await expect(pendingRuntime).toContainText(/待接入|不可用/)

    await window.locator('[data-testid="desktop-nav-settings"]').click()
    await expect(window.locator('[data-testid^="desktop-settings-item-"]').first()).toBeVisible()
  })

  test('打开 Web 工作台目标不可用时显示中文错误', async () => {
    await window.locator('[data-testid="desktop-nav-workspace"]').click()
    const openBtn = window.locator('[data-testid="desktop-agent-config"]').getByText('打开 Web 工作台')
    await openBtn.click()
    const errorMsg = window.locator('[data-testid="web-workspace-error"]')
    await expect(errorMsg).toBeVisible({ timeout: 5000 })
    const errorText = await errorMsg.textContent()
    expect(errorText).toContain('无法连接')
  })

  test('1200x800 下主壳无横向滚动且三区不重叠', async () => {
    await window.locator('[data-testid="desktop-nav-workspace"]').click()
    await window.setViewportSize({ width: 1200, height: 800 })
    const scrollWidth = await window.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await window.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

    const sidebar = await window.locator('[data-testid="desktop-session-sidebar"]').boundingBox()
    const session = await window.locator('[data-testid="desktop-agent-session"]').boundingBox()
    const config = await window.locator('[data-testid="desktop-agent-config"]').boundingBox()

    expect(sidebar).not.toBeNull()
    expect(session).not.toBeNull()
    expect(config).not.toBeNull()

    // Left sidebar ends before center starts
    expect(sidebar!.x + sidebar!.width).toBeLessThanOrEqual(session!.x + 1)
    // Center ends before right starts
    expect(session!.x + session!.width).toBeLessThanOrEqual(config!.x + 1)
  })

  test('1200x800 布局截图', async () => {
    await window.locator('[data-testid="desktop-nav-workspace"]').click()
    await window.setViewportSize({ width: 1200, height: 800 })
    await window.screenshot({ path: 'e2e/artifacts/desktop-main-shell-1200x800.png' })
  })

  test('关键页面视觉截图', async () => {
    await window.setViewportSize({ width: 1200, height: 800 })

    await window.locator('[data-testid="desktop-nav-workspace"]').click()
    await window.screenshot({ path: 'e2e/artifacts/desktop-workspace-page-1200x800.png' })

    await window.locator('[data-testid="desktop-nav-agents"]').click()
    await expect(window.locator('[data-testid="desktop-agent-config-page"]')).toBeVisible()
    await window.screenshot({ path: 'e2e/artifacts/desktop-agent-config-page-1200x800.png' })

    await window.locator('[data-testid="desktop-nav-approvals"]').click()
    await expect(window.locator('[data-testid="desktop-approvals-page"]')).toBeVisible()
    await window.screenshot({ path: 'e2e/artifacts/desktop-approvals-page-1200x800.png' })

    await window.locator('[data-testid="desktop-nav-settings"]').click()
    await expect(window.locator('[data-testid="desktop-settings-page"]')).toBeVisible()
    await window.screenshot({ path: 'e2e/artifacts/desktop-settings-page-1200x800.png' })
  })
})
