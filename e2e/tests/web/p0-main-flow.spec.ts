import { test, expect } from '@playwright/test'
import { ensureP0StorageState } from '../../helpers/auth-state'
import { assertNoHorizontalScroll, assertNoElementOverlap } from '../../helpers/visual-assertions'

/**
 * TEST-REALITY-GATE-001 (REG-20260531-011 / PRGA-010) G4：p0-main-flow.spec.ts 断言全链路终态。
 *
 * 修复前：用 if (await x.isVisible()) 条件保护包住每一步——选择器对不上就静默跳过核心断言，
 * 发送后无任何回复/错误态断言，reload 后无持久化断言，是典型的「silent pass」假绿。
 *
 * 修复后：去掉所有条件保护，按真实 UI 选择器硬断言完整主链路终态：
 *   workspace 创建 → 进工作台 → 新建会话 → @架构师 → 发送 → /api/chat 被调用
 *   → 回复（worker）或明确中文错误态（无 worker）→ reload 后用户消息持久化 → 视觉/布局断言。
 * 缺真实 DB session 时显式 test.skip 并标 DEFERRED，绝不 silent pass。
 */
const hasAuth = !!(process.env.TEST_AUTH_COOKIE || process.env.TEST_AUTH_COOKIE_VALUE || process.env.TEST_AUTH_STORAGE_STATE)
const workerMode = process.env.RUNTIME_E2E === '1'

test.describe('P0 Web 主链路（PRGA-010 真实终态断言）', () => {
  test.skip(!hasAuth, 'DEFERRED：需真实 DB session（TEST_AUTH_COOKIE/TEST_AUTH_STORAGE_STATE），CI 无真实 Supabase 时跳过')

  let storageState: string

  test.beforeAll(async () => {
    storageState = await ensureP0StorageState()
  })

  test('Workspace 创建 → Session → @架构师 → 发送 → 回复/错误态 → reload 持久化', async ({ browser }) => {
    const context = await browser.newContext({ storageState })
    const page = await context.newPage()
    const ts = Date.now()

    // 1) UI 真实创建 workspace（走真实 POST /api/workspaces）
    await page.goto('/workspace')
    await expect(page.getByRole('heading', { name: '我的工作区' })).toBeVisible()
    const wsName = `E2E-P0FLOW-${ts}`
    await page.getByRole('button', { name: '新建工作区' }).click()
    await page.getByPlaceholder('输入工作区名称').fill(wsName)
    await page.getByRole('button', { name: '创建', exact: true }).click()
    await expect(page.getByPlaceholder('输入工作区名称')).not.toBeVisible()

    // 2) 进入工作台（硬断言 shell + chat panel，不再 if-isVisible 静默跳过）
    await page.getByRole('button', { name: wsName }).click()
    await page.waitForURL(/\/workspace\//)
    await expect(page.getByTestId('workspace-shell')).toBeVisible()
    await expect(page.getByTestId('chat-panel')).toBeVisible()

    // 3) 新建会话
    await page.getByRole('button', { name: '新建会话' }).click()
    await expect(page.getByTestId('session-list')).toBeVisible()

    // 4) @架构师（默认 orchestrator 自动 seed）
    await page.getByRole('button', { name: '提及角色' }).click()
    const picker = page.getByTestId('role-picker')
    await expect(picker).toBeVisible()
    await picker.getByText('@架构师').click()
    await expect(page.getByTestId('selected-role')).toHaveText(/架构师/)

    // 5) 发送（走真实 /api/chat），监听确认链路被调用
    let chatCalled = false
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/api/chat')) chatCalled = true
    })
    const msg = `E2E-P0FLOW-ASK-${ts}`
    await page.getByPlaceholder(/输入消息/).fill(msg)
    const [chatRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/chat') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /发送/ }).click(),
    ])
    await chatRes.finished()
    expect(chatRes.ok()).toBeTruthy()
    expect(chatCalled).toBeTruthy()

    // 用户气泡可见（真实落库）
    await expect(page.locator('.bg-primary\\/10', { hasText: msg })).toBeVisible({ timeout: 10000 })

    // 6) 终态断言：有 worker → 可见非 echo agent 回复；无 worker → 明确中文错误态（无 silent pass）
    if (workerMode) {
      const badge = page.getByTestId('message-role-badge')
      await expect(badge.first()).toBeVisible({ timeout: 30000 })
      await expect(badge.first()).toHaveText(/架构师/)
      const agentReply = page.locator('.bg-muted p').first()
      await expect(agentReply).toBeVisible({ timeout: 30000 })
      await expect(agentReply).not.toContainText(msg)
      await expect(agentReply).toContainText('返回的回复')
    } else {
      const notice = page.locator('.bg-muted p', {
        hasText: /Runtime (未就绪|尚未配置)|运行时执行失败|未收到回复|运行时连接已断开|运行时离线/,
      })
      await expect(notice.first()).toBeVisible({ timeout: 15000 })
      await expect(page.getByTestId('message-role-badge')).toHaveCount(0)
    }

    // 7) 视觉/布局断言：三栏容器不重叠 + 无横向滚动（拒绝仅 toBeVisible）
    await assertNoHorizontalScroll(page)
    await assertNoElementOverlap(page, '[data-testid="workspace-shell"] > *')

    // 8) reload 持久化：用户消息从 DB 重新加载
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('.bg-primary\\/10', { hasText: msg })).toBeVisible({ timeout: 10000 })
    if (workerMode) {
      await expect(page.getByTestId('message-role-badge').first()).toBeVisible({ timeout: 10000 })
    }

    await context.close()
  })

  test('工作台三栏布局：无横向滚动、容器不重叠', async ({ browser }) => {
    const context = await browser.newContext({ storageState })
    const page = await context.newPage()
    const ts = Date.now()

    // 真实创建并进入 workspace（不依赖列表首项是否存在的条件保护）
    const wsResp = await page.request.post('/api/workspaces', {
      data: { name: `E2E-P0LAYOUT-${ts}`, execution_domain: 'cloud' },
    })
    expect(wsResp.ok()).toBeTruthy()
    const workspaceId = (await wsResp.json()).id as string

    await page.goto(`/workspace/${workspaceId}`)
    await expect(page.getByTestId('workspace-shell')).toBeVisible()
    await assertNoHorizontalScroll(page)
    await assertNoElementOverlap(page, '[data-testid="workspace-shell"] > *')

    await context.close()
  })
})
