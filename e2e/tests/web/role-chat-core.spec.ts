import { test, expect } from '@playwright/test'
import { ensureAcceptanceStorageState } from '../../helpers/auth-state'
import { assertNoHorizontalScroll, assertNoElementOverlap } from '../../helpers/visual-assertions'
import { openOrchestratorDirectChat } from '../../helpers/chat-entry'

/**
 * ROLE-CHAT-CORE-001 E2E (TASK-005) — real DB, no main-chain API mocks.
 *
 * P0 harness boundary: no Redis / runtime worker, so the public_cloud chat path emits
 * endpoint_unavailable and no agent reply streams back. This spec therefore asserts the
 * runtime-independent golden path: workspace create → open Orchestrator direct chat →
 * send persists the user message with role context → reload retains it.
 * Agent-reply role-badge assertion is deferred to a Redis+worker-enabled environment.
 */
test.describe('ROLE-CHAT-CORE 角色对话链路', () => {
  let storageState: string

  test.beforeAll(async () => {
    storageState = await ensureAcceptanceStorageState()
  })

  test('创建工作区 → Orchestrator 单聊 → 发送持久化 → reload 保留', async ({ browser }) => {
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
    await openOrchestratorDirectChat(page)

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
    await openOrchestratorDirectChat(page)
    await expect(page.getByTestId('chat-panel').locator('.bg-primary\\/10', { hasText: msg })).toBeVisible({ timeout: 10000 })

    await context.close()
  })
})
