import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { type ChildProcess } from 'child_process'
import { startDesktopVite, stopProcessTree, waitForViteReady } from './desktop-test-utils'
import path from 'path'
import fs from 'fs'

const desktopRoot = path.resolve(__dirname, '../../../apps/desktop')
const artifactDir = path.resolve(__dirname, '../artifacts/desktop')

let viteProcess: ChildProcess
let electronApp: ElectronApplication
let window: Page

test.describe('Desktop Connector Console 视觉门禁', () => {
  test.beforeAll(async () => {
    fs.mkdirSync(artifactDir, { recursive: true })

    viteProcess = startDesktopVite(desktopRoot, '5175')
    await waitForViteReady(viteProcess)

    electronApp = await electron.launch({
      args: [path.join(desktopRoot, 'dist/main/main/index.js')],
      cwd: desktopRoot,
      env: { ...process.env, NODE_ENV: 'development', VITE_PORT: '5175' },
    })

    window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')
  })

  test.afterAll(async () => {
    await electronApp?.close()
    await stopProcessTree(viteProcess)
  })

  test('1200x800 下无横向滚动', async () => {
    await window.setViewportSize({ width: 1200, height: 800 })
    const scrollWidth = await window.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await window.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  test('三栏不重叠', async () => {
    const shell = window.locator('[data-testid="desktop-main-shell"]')
    await expect(shell).toBeVisible({ timeout: 10000 })

    const sidebar = await window.locator('[data-testid="desktop-session-sidebar"]').boundingBox()
    const session = await window.locator('[data-testid="desktop-agent-session"]').boundingBox()
    const config = await window.locator('[data-testid="desktop-agent-config"]').boundingBox()

    if (sidebar && session && config) {
      expect(sidebar.x + sidebar.width).toBeLessThanOrEqual(session.x + 1)
      expect(session.x + session.width).toBeLessThanOrEqual(config.x + 1)
    }
  })

  test('无敏感字段（API Key/Base URL）', async () => {
    const sensitiveInputs = await window.locator('input[placeholder*="API"], input[placeholder*="Base URL"], input[placeholder*="sk-"]').count()
    expect(sensitiveInputs).toBe(0)

    const sensitiveText = await window.locator('text=/ANTHROPIC_API_KEY|OPENAI_API_KEY/').count()
    expect(sensitiveText).toBe(0)
  })

  test('截图留存 - Console 全貌', async () => {
    await window.screenshot({ path: path.join(artifactDir, 'connector-console-1200x800.png'), fullPage: true })
  })

  test('统一视觉母版断言', async () => {
    await window.waitForSelector('[data-testid="desktop-main-shell"]')
    const result = await window.evaluate(() => {
      const tokenPatterns = [
        'bg-card', 'bg-background', 'bg-muted', 'bg-primary',
        'text-primary', 'text-muted-foreground', 'text-foreground',
        'border-border', 'rounded-md', 'rounded-lg',
      ]
      const allElements = document.querySelectorAll('[class]')
      const tokenHits = new Set<string>()
      allElements.forEach(el => {
        const cls = el.getAttribute('class') || ''
        for (const t of tokenPatterns) {
          if (cls.includes(t)) tokenHits.add(t)
        }
      })
      let inlineCount = 0
      document.querySelectorAll('[style]').forEach(el => {
        const s = (el as HTMLElement).style
        if (s.backgroundColor || s.color || s.borderRadius || s.border) inlineCount++
      })
      return { tokenCount: tokenHits.size, hasInlineStyleAbuse: inlineCount > 5 }
    })
    expect(result.tokenCount).toBeGreaterThanOrEqual(4)
    expect(result.hasInlineStyleAbuse).toBe(false)
  })

  test('三端对照截图 - Desktop Console', async () => {
    const crossDir = path.resolve(__dirname, '../artifacts/cross-surface/workspace')
    fs.mkdirSync(crossDir, { recursive: true })
    await window.screenshot({ path: path.join(crossDir, 'desktop.png'), fullPage: true })
  })
})
