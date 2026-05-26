import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

const desktopRoot = path.resolve(__dirname, '../../../apps/desktop')
let viteProcess: ChildProcess
let electronApp: ElectronApplication
let window: Page

test.describe('Desktop 主壳基础验证', () => {
  test.beforeAll(async () => {
    viteProcess = spawn('npx', ['vite', '--port', '5174'], {
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
      env: { ...process.env, NODE_ENV: 'development', VITE_PORT: '5174' },
    })

    window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')
  })

  test.afterAll(async () => {
    await electronApp?.close()
    viteProcess?.kill('SIGTERM')
  })

  test('显示 desktop-main-shell 定位点', async () => {
    const shell = window.locator('[data-testid="desktop-main-shell"]')
    await expect(shell).toBeVisible({ timeout: 10000 })
  })

  test('顶部状态条显示用户和设备信息', async () => {
    await expect(window.getByText('AgentHub 桌面连接器')).toBeVisible()
    await expect(window.getByText('MacBook Pro')).toBeVisible()
  })

  test('Runtime 检测区域无 API Key 和 Base URL 输入框', async () => {
    const apiKeyInput = window.locator('input[placeholder*="API"]')
    await expect(apiKeyInput).toHaveCount(0)

    const baseUrlInput = window.locator('input[placeholder*="Base URL"]')
    await expect(baseUrlInput).toHaveCount(0)

    const sensitiveText = window.locator('text=/ANTHROPIC_API_KEY|OPENAI_API_KEY|Base URL/')
    await expect(sensitiveText).toHaveCount(0)
  })

  test('1200x800 下无横向滚动', async () => {
    await window.setViewportSize({ width: 1200, height: 800 })
    const scrollWidth = await window.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await window.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })
})
