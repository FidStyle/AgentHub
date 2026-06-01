import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { type ChildProcess } from 'child_process'
import { startDesktopVite, stopProcessTree, waitForViteReady } from './desktop-test-utils'
import path from 'path'

const desktopRoot = path.resolve(__dirname, '../../../apps/desktop')
let viteProcess: ChildProcess
let electronApp: ElectronApplication
let window: Page

test.describe('Desktop Electron', () => {
  test.beforeAll(async () => {
    viteProcess = startDesktopVite(desktopRoot, '5173')
    await waitForViteReady(viteProcess)

    electronApp = await electron.launch({
      args: [path.join(desktopRoot, 'dist/main/main/index.js')],
      cwd: desktopRoot,
      env: { ...process.env, NODE_ENV: 'development' },
    })

    window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')
  })

  test.afterAll(async () => {
    await electronApp?.close()
    await stopProcessTree(viteProcess)
  })

  test('启动窗口并显示连接器界面', async () => {
    await expect(window.getByText('AgentHub 桌面连接器')).toBeVisible({ timeout: 10000 })
  })

  test('显示 desktop-main-shell 定位点', async () => {
    const shell = window.locator('[data-testid="desktop-main-shell"]')
    await expect(shell).toBeVisible()
  })

  test('显示 Runtime 检测区域', async () => {
    await expect(window.getByText('Runtime 检测').or(window.getByText('正在检测本地 Runtime'))).toBeVisible({ timeout: 10000 })
  })
})
