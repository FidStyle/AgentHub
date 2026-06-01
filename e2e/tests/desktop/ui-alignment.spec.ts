import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { type ChildProcess } from 'child_process'
import { startDesktopVite, stopProcessTree, waitForViteReady } from './desktop-test-utils'
import path from 'path'
import fs from 'fs'

const desktopRoot = path.resolve(__dirname, '../../../apps/desktop')
const artifactDir = path.resolve(__dirname, '../../artifacts/desktop')

let viteProcess: ChildProcess
let electronApp: ElectronApplication
let window: Page

test.describe('Desktop UI 对齐修复断言', () => {
  test.beforeAll(async () => {
    fs.mkdirSync(artifactDir, { recursive: true })

    viteProcess = startDesktopVite(desktopRoot, '5176')
    await waitForViteReady(viteProcess)

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
    await stopProcessTree(viteProcess)
  })

  test('侧栏导航项包含 lucide 图标', async () => {
    await window.waitForSelector('[data-testid="desktop-session-sidebar"]')
    const icons = await window.locator('[data-testid="desktop-session-sidebar"] nav svg').count()
    expect(icons).toBeGreaterThanOrEqual(5)
  })

  test('GitHub 登录按钮包含图标', async () => {
    const githubBtn = window.locator('[data-auth-action="github-login"] svg')
    await expect(githubBtn).toBeVisible()
  })

  test('Agent 配置页无营销文案', async () => {
    await window.locator('[data-testid="desktop-nav-agents"]').click()
    await window.waitForSelector('[data-testid="desktop-agent-config-page"]')
    const marketingText = await window.locator('text="即将支持，敬请期待"').count()
    expect(marketingText).toBe(0)
  })

  test('Agent 配置页待接入卡片有诊断引导', async () => {
    await window.locator('[data-testid="desktop-nav-agents"]').click()
    await expect(window.locator('[data-testid="desktop-agent-config-page"]')).toBeVisible()
    const guidanceText = await window.locator('text=/未完成真实检测|未检测到运行实例|请先重新检测本地 Runtime/').count()
    expect(guidanceText).toBeGreaterThanOrEqual(1)
  })

  test('Agent 会话输入框使用 @agenthub/ui Input', async () => {
    await window.locator('[data-testid="desktop-nav-workspace"]').click()
    await window.waitForSelector('[data-testid="desktop-agent-session"]')
    const nativeInputs = await window.evaluate(() => {
      const composer = document.querySelector('[data-testid="desktop-agent-composer"]')
      if (!composer) return 0
      const inputs = composer.querySelectorAll('input')
      let nativeCount = 0
      inputs.forEach(input => {
        const cls = input.getAttribute('class') || ''
        if (!cls.includes('border-input') && !cls.includes('bg-background')) nativeCount++
      })
      return nativeCount
    })
    expect(nativeInputs).toBe(0)
  })

  test('截图留存 - 侧栏图标', async () => {
    const sidebar = window.locator('[data-testid="desktop-session-sidebar"]')
    await sidebar.screenshot({ path: path.join(artifactDir, 'sidebar-icons.png') })
  })
})
