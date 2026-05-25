import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

const desktopRoot = path.resolve(__dirname, '../../../apps/desktop')
let viteProcess: ChildProcess
let electronApp: ElectronApplication
let window: Page

test.describe('Desktop Electron', () => {
  test.beforeAll(async () => {
    viteProcess = spawn('npx', ['vite', '--port', '5173'], {
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
      env: { ...process.env, NODE_ENV: 'development' },
    })

    window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')
  })

  test.afterAll(async () => {
    await electronApp?.close()
    viteProcess?.kill('SIGTERM')
  })

  test('启动窗口并显示连接器界面', async () => {
    await expect(window.getByText('AgentHub 桌面连接器')).toBeVisible({ timeout: 10000 })
  })

  test('显示 connector-console 定位点', async () => {
    const console = window.locator('[data-testid="connector-console"]')
    await expect(console).toBeVisible()
  })

  test('显示 Runtime 检测区域', async () => {
    await expect(window.getByText('Runtime 检测').or(window.getByText('正在检测本地 Runtime'))).toBeVisible({ timeout: 10000 })
  })
})
