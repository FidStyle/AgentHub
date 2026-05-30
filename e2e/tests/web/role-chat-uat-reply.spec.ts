import { test, expect } from '@playwright/test'
import { ensureP0StorageState } from '../../helpers/auth-state'
import { assertNoHorizontalScroll, assertNoElementOverlap } from '../../helpers/visual-assertions'

/**
 * ROLE-CHAT-UAT-REPLY-001 E2E — 真实 DB + 真实 Redis + 真实 worker(FakeExecutor)，无主链路 mock。
 *
 * 关闭 ROLE-CHAT-CORE-001 deferred 的 P0 缺口：@架构师发送后必须出现可见 agent 回复。
 *   1. open /workspace/:id（cloud domain）→ 新建 session → @架构师 → 发送
 *   2. 等到可见 agent 回复文本（FakeExecutor 输出，经 redis worker 回流）
 *   3. 回复带 role badge（角色上下文标识）
 *   4. UI 视觉/布局断言：无横向滚动 + 三栏不重叠
 *   5. reload 后用户消息与 agent 回复都从 DB 重新加载保留（agent 回复落 messages 表）
 *
 * 需 Redis+worker：由 global-setup 在 RUNTIME_E2E=1 时拉起；未拉起则跳过（避免误判）。
 */
const runtimeEnabled = process.env.RUNTIME_E2E === '1'

test.describe('ROLE-CHAT-UAT-REPLY 可见 agent 回复闭环', () => {
  let storageState: string

  test.beforeAll(async () => {
    storageState = await ensureP0StorageState()
  })

  test.skip(!runtimeEnabled, '需 Redis+worker 环境（RUNTIME_E2E=1，pnpm env:runtime:up）')

  test('open workspace → @架构师 → 发送 → 可见回复 + role badge + 视觉 + reload 双向持久化', async ({ browser }) => {
    const context = await browser.newContext({ storageState })
    const page = await context.newPage()

    const ts = Date.now()
    const res = await page.request.post('/api/workspaces', {
      data: { name: `E2E-UATREPLY-${ts}`, execution_domain: 'cloud' },
    })
    expect(res.ok()).toBeTruthy()
    const wsId = (await res.json()).id as string

    await page.goto(`/workspace/${wsId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByTestId('workspace-shell')).toBeVisible()

    await page.getByRole('button', { name: '新建会话' }).click()
    await expect(page.getByTestId('session-list')).toBeVisible()

    await page.getByRole('button', { name: '提及角色' }).click()
    const picker = page.getByTestId('role-picker')
    await expect(picker).toBeVisible()
    await picker.getByText('@架构师').click()

    const msg = `UATREPLY-ASK-${ts}`
    await page.getByPlaceholder(/输入消息/).fill(msg)
    await page.getByRole('button', { name: /发送/ }).click()

    // 硬验收：必须出现可见 agent 回复文本（非仅 /api/chat request），带 role badge。
    const badge = page.getByTestId('message-role-badge')
    await expect(badge.first()).toBeVisible({ timeout: 30000 })
    await expect(badge.first()).toHaveText(/架构师/)
    // agent 回复文本可见（FakeExecutor 产出非空内容）
    const agentReply = page.locator('.bg-muted p').first()
    await expect(agentReply).toBeVisible({ timeout: 30000 })
    await expect(agentReply).not.toHaveText('')

    // 视觉/布局断言
    await assertNoHorizontalScroll(page)
    await assertNoElementOverlap(page, '[data-testid="workspace-shell"] > *')

    // reload：用户消息 + agent 回复都从 DB 重新加载（agent 回复落 messages 表）。
    // FakeExecutor 回显问题文本，故按用户气泡(.bg-primary/10)精确定位用户消息，避免与 agent 回显串味。
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('.bg-primary\\/10', { hasText: msg })).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('message-role-badge').first()).toBeVisible({ timeout: 10000 })

    await context.close()
  })
})
