import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { spawn, ChildProcess } from 'child_process'
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

    viteProcess = spawn('npx', ['vite', '--port', '5175'], {
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
      env: { ...process.env, NODE_ENV: 'development', VITE_PORT: '5175' },
    })

    window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')
  })

  test.afterAll(async () => {
    await electronApp?.close()
    viteProcess?.kill('SIGTERM')
  })

  test('1200x800 下无横向滚动', async () => {
    await window.setViewportSize({ width: 1200, height: 800 })
    const scrollWidth = await window.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await window.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  test('状态卡不重叠', async () => {
    const cards = await window.locator('[data-testid="connector-console"] .rounded-md').all()
    if (cards.length < 2) return

    const rects = await window.$$eval('[data-testid="connector-console"] .rounded-md', els =>
      els.map(el => {
        const r = el.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
      })
    )
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j]
        const overlaps = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
        expect(overlaps, `Cards ${i} and ${j} overlap`).toBe(false)
      }
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
})
