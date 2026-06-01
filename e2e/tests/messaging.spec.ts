import { test, expect } from './fixtures'

// TEST-REALITY-GATE-001 (REG-20260531-011 / PRGA-008) G2：messaging.spec.ts 真实走 /api/chat。
//
// 修复前：mock /api/chat + mock sessions/messages，且只断言用户气泡（.bg-blue-500，连 class 都过期），
// 从不断言 agent 回复——发送链路完全不被门禁覆盖；且该文件位于 tests/ 根目录，不在任何 project
// testMatch 内，从不执行。
//
// 修复后：真实 workspace/session（authed context，非 mock），打开真实 UI 发送，断 POST /api/chat 被调用，
// 并按 runtime 环境断言用户目标终态（非 toBeVisible 糊弄）：
//   - RUNTIME_E2E=1（真实 worker）：可见非 echo agent 回复 + role badge + reload 双向持久化
//   - RUNTIME_E2E_NOWORKER=1（Redis 无 worker）：立即明确中文错误态（不空等），无 role badge
//   - 默认（public_cloud unconfigured）：立即明确中文错误/系统提示，无 role badge（不静默仅存用户消息）
//
// 缺真实 DB session 时显式 test.skip 并标 DEFERRED。

const hasAuth = !!(process.env.TEST_AUTH_COOKIE || process.env.TEST_AUTH_COOKIE_VALUE || process.env.TEST_AUTH_STORAGE_STATE)
const workerMode = process.env.RUNTIME_E2E === '1'

test.describe('消息发送真实走 /api/chat（PRGA-008）', () => {
  test.skip(!hasAuth, 'DEFERRED：需真实 DB session（TEST_AUTH_COOKIE/TEST_AUTH_STORAGE_STATE），CI 无真实 Supabase 时跳过')

  test('真实 workspace → 新建会话 → @Orchestrator → 发送 → /api/chat 被调用 → 回复或明确错误态 → reload 持久化', async ({ authedPage: page }) => {
    const ts = Date.now()
    const wsResp = await page.request.post('/api/workspaces', {
      data: { name: `E2E-MSG-${ts}`, execution_domain: 'cloud' },
    })
    expect(wsResp.ok()).toBeTruthy()
    const workspaceId = (await wsResp.json()).id as string

    await page.goto(`/workspace/${workspaceId}`)
    await expect(page.getByTestId('workspace-shell')).toBeVisible()

    await page.getByRole('button', { name: '新建会话' }).click()
    await expect(page.getByTestId('session-list')).toBeVisible()

    // 打开 @角色选择器，默认 Orchestrator 自动 seed
    await page.getByRole('button', { name: '提及角色' }).click()
    const picker = page.getByTestId('role-picker')
    await expect(picker).toBeVisible()
    await picker.getByText('@Orchestrator').click()
    await expect(page.getByTestId('selected-role')).toHaveText(/Orchestrator/)

    // 监听 POST /api/chat 被调用（修复前根本不发真实请求）
    let chatCalled = false
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/api/chat')) chatCalled = true
    })

    const msg = `E2E-MSG-ASK-${ts}`
    await page.getByTestId('composer-input').fill(msg)
    const [chatRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/chat') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /发送/ }).click(),
    ])
    await chatRes.finished()
    expect(chatRes.ok()).toBeTruthy()

    // 用户气泡先可见（真实落库，定位真实 .bg-primary/10 而非过期 .bg-blue-500）
    await expect(page.getByTestId('chat-panel').locator('.bg-primary\\/10', { hasText: msg })).toBeVisible({ timeout: 10000 })

    if (workerMode) {
      // 有 worker：断言可见非 echo agent 回复 + role badge
      const badge = page.getByTestId('message-role-badge')
      await expect(badge.first()).toBeVisible({ timeout: 30000 })
      await expect(badge.first()).toHaveText(/Orchestrator/)
      const agentReply = page.locator('.bg-muted p').first()
      await expect(agentReply).toBeVisible({ timeout: 30000 })
      await expect(agentReply).not.toHaveText('')
      await expect(agentReply).not.toContainText(msg)
      await expect(agentReply).toContainText('返回的回复')

      await page.reload()
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByTestId('chat-panel').locator('.bg-primary\\/10', { hasText: msg })).toBeVisible({ timeout: 10000 })
      await expect(page.getByTestId('message-role-badge').first()).toBeVisible({ timeout: 10000 })
    } else {
      // 无 worker / public_cloud unconfigured：发送必须立即出现明确中文错误/系统提示，绝不静默仅存用户消息。
      const notice = page.locator('.bg-muted p', {
        hasText: /Runtime (未就绪|尚未配置)|运行时执行失败|未收到回复|运行时连接已断开|运行时离线/,
      })
      await expect(notice.first()).toBeVisible({ timeout: 15000 })
      // 系统态错误不得伪造成 agent 真实回答（无 role badge）
      await expect(page.getByTestId('message-role-badge')).toHaveCount(0)

      // reload：用户消息持久化；错误态不被误存为 agent 回复
      await page.reload()
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByTestId('chat-panel').locator('.bg-primary\\/10', { hasText: msg })).toBeVisible({ timeout: 10000 })
      await expect(page.getByTestId('message-role-badge')).toHaveCount(0)
    }

    // 硬断言：发送确实走了 /api/chat runtime 链路（非旧 mock 假绿）
    expect(chatCalled).toBeTruthy()
  })
})
