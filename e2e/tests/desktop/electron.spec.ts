import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { execSync, spawn, ChildProcess } from 'child_process'
import path from 'path'

const desktopRoot = path.resolve(__dirname, '../../../apps/desktop')
let viteProcess: ChildProcess
let electronApp: ElectronApplication
let window: Page

test.describe('Desktop Electron', () => {
  test.beforeAll(async () => {
    execSync('pnpm --filter @agenthub/desktop build', {
      cwd: path.resolve(desktopRoot, '../..'),
      stdio: 'pipe',
    })

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
    await expect(window.getByRole('button', { name: 'Runtime 配置' })).toBeVisible()
  })

  test('点击 Tab 切换到 Runtime 配置页', async () => {
    await window.getByRole('button', { name: 'Runtime 配置' }).click()

    await expect(window.getByText('Claude Code', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(window.getByText('Codex (OpenAI)')).toBeVisible()
  })

  test('展开 Claude Code 卡片并切换认证模式显示表单', async () => {
    await window.getByText('Claude Code', { exact: true }).click()

    await expect(window.getByText('认证模式')).toBeVisible({ timeout: 5000 })

    const select = window.locator('select').first()
    await select.selectOption('api_key')

    // 使用 FieldRow label 的 span 精确匹配
    await expect(window.locator('span:text-is("API Key")')).toBeVisible()
    await expect(window.getByText('Base URL (可选)')).toBeVisible()
    await expect(window.getByText('Model (可选)')).toBeVisible()
  })

  test('填写 API Key 并验证输入值和显示切换', async () => {
    const apiKeyInput = window.locator('input[placeholder="输入 ANTHROPIC_API_KEY"]')
    await apiKeyInput.fill('sk-test-12345')
    await expect(apiKeyInput).toHaveValue('sk-test-12345')

    await expect(apiKeyInput).toHaveAttribute('type', 'password')

    await window.getByRole('button', { name: '显示' }).click()
    await expect(apiKeyInput).toHaveAttribute('type', 'text')

    await window.getByRole('button', { name: '隐藏' }).click()
    await expect(apiKeyInput).toHaveAttribute('type', 'password')
  })

  test('填写 Base URL 和 Model', async () => {
    const baseUrlInput = window.locator('input[placeholder="留空使用官方地址"]')
    await baseUrlInput.fill('https://api.example.com')
    await expect(baseUrlInput).toHaveValue('https://api.example.com')

    const modelInput = window.locator('input[placeholder="留空使用默认模型"]')
    await modelInput.fill('claude-sonnet-4-6')
    await expect(modelInput).toHaveValue('claude-sonnet-4-6')
  })

  test('展开高级环境变量编辑器', async () => {
    await window.getByRole('button', { name: /高级：环境变量/ }).click()

    const textarea = window.locator('textarea[placeholder="KEY=VALUE 格式，每行一个"]')
    await expect(textarea).toBeVisible()

    await textarea.fill('CUSTOM_VAR=hello\nDEBUG=true')
    await expect(textarea).toHaveValue('CUSTOM_VAR=hello\nDEBUG=true')
  })

  test('点击保存配置成功', async () => {
    const saveBtn = window.getByRole('button', { name: '保存配置' })
    await saveBtn.click()

    // IPC save 很快完成，断言按钮恢复到可点击状态（非 disabled）
    await expect(saveBtn).toBeEnabled({ timeout: 5000 })
    // 保存后按钮文字仍为"保存配置"（非"保存中..."）
    await expect(window.getByRole('button', { name: '保存配置' })).toBeVisible()
  })

  test('点击测试连接并验证结果反馈', async () => {
    const testBtn = window.getByRole('button', { name: '测试连接' })
    await expect(testBtn).toBeVisible()
    await testBtn.click()

    // 等待测试完成（按钮恢复）
    await expect(window.getByRole('button', { name: '测试连接' })).toBeEnabled({ timeout: 15000 })

    // 测试结果标记应出现（✓ 或 ✗）
    await expect(window.locator('span').filter({ hasText: /[✓✗]/ }).first()).toBeVisible()
  })

  test('切回连接器 Tab 验证导航正常', async () => {
    await window.getByRole('button', { name: '连接器' }).click()

    await expect(window.getByText('认证模式')).not.toBeVisible()
  })
})
