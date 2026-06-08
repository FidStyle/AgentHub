import { test, expect } from '@playwright/test'
import { ensureAcceptanceStorageState } from '../../helpers/auth-state'
import { openOrchestratorDirectChat } from '../../helpers/chat-entry'

/**
 * ROLE-CHAT-NO-WORKER E2E — 真实 DB + 真实浏览器，public_cloud 无可用 worker。
 *
 * 关闭 REG-20260530-006 的另一半：无 worker / 未配置 endpoint 时，Orchestrator 单聊发送必须「立即」
 * 给出明确中文错误态，绝不空等 60s idle timeout，也绝不伪造 agent 成功回复。
 *   1. open /workspace/:id（cloud domain）→ 打开 Orchestrator 单聊 → 发送
 *   2. POST /api/chat 必须在 60s idle timeout 之前快速返回（断言 < 15s，远低于 60s）
 *   3. UI 出现中文错误系统提示（公共云端 Runtime 未就绪/尚未配置）
 *   4. 该提示不带 role badge（系统态，非伪造 agent 回答）
 *
 * 默认不可跳过：以 RUNTIME_E2E_NOWORKER=1 运行（global-setup 仅拉起 Redis、不拉 worker，
 * 并向 web server 注入 REDIS_URL）。未设置则 fail-loud，确保 no-worker 错误态门禁始终覆盖。
 */
const noWorkerEnabled = process.env.RUNTIME_E2E_NOWORKER === '1'

test.describe('ROLE-CHAT-NO-WORKER 无 worker 立即错误态', () => {
  let storageState: string

  test.beforeAll(async () => {
    if (!noWorkerEnabled) {
      throw new Error(
        'ROLE-CHAT-NO-WORKER 需 Redis-但-无-worker 环境：请以 RUNTIME_E2E_NOWORKER=1 运行，不允许静默跳过无 worker 错误态门禁',
      )
    }
    storageState = await ensureAcceptanceStorageState()
  })

  test('open workspace → Orchestrator 单聊 → 发送 → 立即中文错误态（不空等 60s，无 role badge）', async ({ browser }) => {
    const context = await browser.newContext({ storageState })
    const page = await context.newPage()

    const ts = Date.now()
    const res = await page.request.post('/api/workspaces', {
      data: { name: `E2E-NOWORKER-${ts}`, execution_domain: 'cloud' },
    })
    expect(res.ok()).toBeTruthy()
    const wsId = (await res.json()).id as string

    await page.goto(`/workspace/${wsId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByTestId('workspace-shell')).toBeVisible()
    await openOrchestratorDirectChat(page)

    const msg = `NOWORKER-ASK-${ts}`
    await page.getByTestId('composer-input').fill(msg)

    // 关键断言：POST /api/chat 必须远早于 60s idle timeout 完成（无空等）。
    const started = Date.now()
    const [chatRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/chat') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /发送/ }).click(),
    ])
    await chatRes.finished()
    const elapsed = Date.now() - started
    expect(chatRes.ok()).toBeTruthy()
    expect(elapsed).toBeLessThan(15000)

    // 中文错误系统提示可见（未就绪/尚未配置任一）。
    const notice = page.locator('.bg-muted p', { hasText: /Runtime (未就绪|尚未配置)/ })
    await expect(notice.first()).toBeVisible({ timeout: 10000 })

    // 该提示为系统态：不得带 role badge（不能伪造成 @Orchestrator 的真实回答）。
    await expect(page.getByTestId('message-role-badge')).toHaveCount(0)

    await context.close()
  })
})
