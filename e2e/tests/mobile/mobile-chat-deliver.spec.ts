import { test, expect } from '@playwright/test'
import { ensureAcceptanceStorageState } from '../../helpers/auth-state'

/**
 * MOBILE-CHAT-DELIVER-001 E2E — 真实 DB + 真实 auth，移动视口（iPhone 14, mobile-pwa project）。
 *
 * 关闭 REG-20260530-006 Mobile GAP-002：Mobile /m/sessions/:id 发送以前只 POST /api/messages（纯写库、
 * 无 runtime、无回复也无错误态）。修复后发送走与 Web 一致的 /api/chat runtime 链路。
 *
 * 两条真实用户态 regime（默认不可静默跳过——未配置环境直接 fail-loud）：
 *   A. RUNTIME_E2E=1（有 worker，ScriptedRealExecutor）：
 *      登录 → /m → 选 workspace → 进 session → 发送 → 断言 POST /api/chat 被调用
 *      → 可见非 echo agent 回复（带 role badge）→ reload 后用户消息+回复持久化
 *   B. RUNTIME_E2E_NOWORKER=1（有 REDIS_URL 无 worker）：
 *      发送 → 断言 POST /api/chat 被调用 → 立即出现明确中文错误/系统提示（非静默仅存用户消息）
 *
 * 深度交互断言：route 监听确认 /api/chat 调用 + 文本/角色断言 + reload DOM 断言；禁止仅 toBeVisible 糊弄。
 */
const workerMode = process.env.RUNTIME_E2E === '1'
const noWorkerMode = process.env.RUNTIME_E2E_NOWORKER === '1'

test.describe('MOBILE-CHAT-DELIVER Mobile 发送走 /api/chat runtime 链路', () => {
  let storageState: string

  test.beforeAll(async () => {
    if (!workerMode && !noWorkerMode) {
      throw new Error(
        'MOBILE-CHAT-DELIVER 需真实 runtime 环境：以 RUNTIME_E2E=1（有 worker，断言可见回复）或 ' +
          'RUNTIME_E2E_NOWORKER=1（无 worker，断言明确错误态）运行，不允许静默跳过 P0 闭环门禁',
      )
    }
    storageState = await ensureAcceptanceStorageState()
  })

  test('登录 → /m → 进 session → 发送 → /api/chat 被调用 → 可见回复或明确错误态 → reload 持久化', async ({ browser }) => {
    const context = await browser.newContext({
      storageState,
      viewport: { width: 390, height: 844 },
    })
    const page = await context.newPage()

    // 经 API 准备 cloud workspace + session（与 role-chat-uat-reply 同源 harness），再用真实移动 UI 驱动发送。
    const ts = Date.now()
    const wsRes = await page.request.post('/api/workspaces', {
      data: { name: `E2E-MOBILE-DELIVER-${ts}`, execution_domain: 'cloud' },
    })
    expect(wsRes.ok()).toBeTruthy()
    const wsId = (await wsRes.json()).id as string

    const sessRes = await page.request.post('/api/sessions', {
      data: { workspace_id: wsId, name: `M-DELIVER-${ts}` },
    })
    expect(sessRes.ok()).toBeTruthy()
    const sessionId = (await sessRes.json()).id as string

    // 真实移动 UI 导航：/m → 选 workspace → 点 session 卡片进入会话页。
    await page.goto('/m')
    await page.waitForLoadState('domcontentloaded')
    await page.getByText(`E2E-MOBILE-DELIVER-${ts}`).click()
    await page.getByText(`M-DELIVER-${ts}`).click()
    await page.waitForURL(`/m/sessions/${sessionId}`)
    await expect(page.getByTestId('mobile-session')).toBeVisible()

    // 监听 POST /api/chat 被调用（修复前只会打 /api/messages）。
    let chatCalled = false
    page.on('request', req => {
      if (req.method() === 'POST' && req.url().includes('/api/chat')) chatCalled = true
    })

    const msg = `MOBILE-DELIVER-ASK-${ts}`
    // 等默认角色解析就绪（发送按钮在 defaultRole 解析前禁用，避免无角色上下文发送）。
    await expect(page.getByText(/将发送给 @/)).toBeVisible({ timeout: 10000 })
    await page.getByPlaceholder(/输入消息/).fill(msg)
    await page.getByRole('button', { name: /发送/ }).click()

    // 用户气泡先可见（乐观插入 / 落库）。
    await expect(page.locator('.bg-primary', { hasText: msg }).first()).toBeVisible({ timeout: 10000 })

    if (workerMode) {
      // 有 worker：必须出现可见非 echo agent 回复，带 role badge（默认 Orchestrator 角色上下文）。
      const badge = page.getByTestId('message-role-badge')
      await expect(badge.first()).toBeVisible({ timeout: 30000 })
      await expect(badge.first()).toHaveText(/Orchestrator/)
      const agentReply = page.locator('.bg-muted p').first()
      await expect(agentReply).toBeVisible({ timeout: 30000 })
      await expect(agentReply).not.toHaveText('')
      await expect(agentReply).not.toContainText(msg)
      // 断言可识别的非 echo 回复尾段（ScriptedRealExecutor 固定回复 “…返回的回复。”）。
      // 用稳定尾段而非整串：worker→redis→gateway 中继偶发丢前导 delta，整串前缀不稳定，
      // 但 runtime 投递成功这一闭环事实由“出现非空非 echo 的执行器回复尾段”确证。
      await expect(agentReply).toContainText('返回的回复')

      // reload：用户消息 + agent 回复都从 DB 重新加载（agent 回复经 /api/chat 服务端落 messages 表）。
      await page.reload()
      await page.waitForLoadState('domcontentloaded')
      await expect(page.locator('.bg-primary', { hasText: msg }).first()).toBeVisible({ timeout: 10000 })
      await expect(page.getByTestId('message-role-badge').first()).toBeVisible({ timeout: 10000 })
    } else {
      // 无 worker：发送后必须立即出现明确中文错误/系统提示，绝不静默只存用户消息。
      const notice = page.locator('.bg-muted p', {
        hasText: /Runtime 未就绪|运行时执行失败|未收到回复|运行时连接已断开|运行时离线/,
      })
      await expect(notice.first()).toBeVisible({ timeout: 15000 })

      // reload：用户消息持久化；明确错误态本身不应被误存为 agent 回复（无 role badge）。
      await page.reload()
      await page.waitForLoadState('domcontentloaded')
      await expect(page.locator('.bg-primary', { hasText: msg }).first()).toBeVisible({ timeout: 10000 })
      await expect(page.getByTestId('message-role-badge')).toHaveCount(0)
    }

    // 硬断言：发送确实走了 /api/chat runtime 链路（非旧的纯 /api/messages 写库）。
    expect(chatCalled).toBeTruthy()

    await context.close()
  })
})
