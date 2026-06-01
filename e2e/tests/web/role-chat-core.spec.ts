import { test, expect } from '@playwright/test'
import { ensureP0StorageState } from '../../helpers/auth-state'
import { assertNoHorizontalScroll, assertNoElementOverlap } from '../../helpers/visual-assertions'

/**
 * ROLE-CHAT-CORE-001 E2E (TASK-005) — real DB, no main-chain API mocks.
 *
 * P0 harness boundary: no Redis / runtime worker, so the public_cloud chat path emits
 * endpoint_unavailable and no agent reply streams back. This spec therefore asserts the
 * runtime-independent golden path: workspace create → default Orchestrator auto-seeds in picker →
 * @-select → send persists the user message with role context → reload retains it.
 * Agent-reply role-badge assertion is deferred to a Redis+worker-enabled environment.
 */
test.describe('ROLE-CHAT-CORE 角色对话链路', () => {
  let storageState: string

  test.beforeAll(async () => {
    storageState = await ensureP0StorageState()
  })

  test('创建工作区 → 默认 Orchestrator → @Orchestrator 选择 → 发送持久化 → reload 保留', async ({ browser }) => {
    const context = await browser.newContext({ storageState })
    const page = await context.newPage()

    const wsName = `E2E-ROLE-${Date.now()}`
    const workspaceRes = await page.request.post('/api/workspaces', {
      data: { name: wsName, execution_domain: 'cloud' },
    })
    expect(workspaceRes.ok()).toBeTruthy()
    const workspace = await workspaceRes.json() as { id: string }

    await page.goto(`/workspace/${workspace.id}`)
    await page.waitForLoadState('domcontentloaded')

    // 新建会话（启用聊天输入）
    await page.getByRole('button', { name: '新建会话' }).click()
    await expect(page.getByTestId('session-list')).toBeVisible()

    // 打开 @角色选择器，默认 Orchestrator 已自动 seed
    await page.getByRole('button', { name: '提及角色' }).click()
    const picker = page.getByTestId('role-picker')
    await expect(picker).toBeVisible()
    await expect(picker.getByText('@Orchestrator')).toBeVisible()
    await picker.getByText('@Orchestrator').click()

    // 已选角色 Badge
    await expect(page.getByTestId('selected-role')).toHaveText(/Orchestrator/)

    // Slash 命令可展开并把常用任务模板写回多行 composer。
    await page.getByTestId('composer-input').fill('/')
    await expect(page.getByTestId('slash-command-menu')).toBeVisible()
    await page.getByTestId('slash-command-menu').getByText('/plan').click()
    await expect(page.getByTestId('composer-input')).toHaveValue(/请先制定执行计划/)

    // 发送消息（经 /api/chat 真实持久化 user message + role_agent_id）
    const msg = `E2E-ASK-${Date.now()}`
    await page.getByTestId('composer-input').fill(msg)
    await page.getByRole('button', { name: /发送/ }).click()
    await page.waitForResponse((r) => r.url().includes('/api/chat') && r.request().method() === 'POST')

    // 布局/视觉断言（拒绝仅 toBeVisible）：三栏容器不重叠 + 无横向滚动
    await assertNoHorizontalScroll(page)
    await assertNoElementOverlap(page, '[data-testid="workspace-shell"] > *')

    // reload 后用户消息从 DB 重新加载（role_agent_id 持久化 + 角色上下文保留）。
    // 启用 worker 时 agent 回复会回显系统提示+问题文本，故按用户气泡(.bg-primary/10)
    // 精确定位，避免与 agent 回显串味（P0 无 worker 时仍是唯一用户气泡）。
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('.bg-primary\\/10', { hasText: msg })).toBeVisible({ timeout: 10000 })

    await context.close()
  })
})
