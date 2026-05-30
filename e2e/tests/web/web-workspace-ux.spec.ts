import { test, expect } from '@playwright/test'
import { ensureP0StorageState } from '../../helpers/auth-state'
import { assertNoHorizontalScroll, assertNoElementOverlap } from '../../helpers/visual-assertions'

/**
 * WEB-WORKSPACE-UX-001 E2E — real DB, no main-chain API mocks.
 *
 * 覆盖 ROLE-CHAT-CORE-001 未触及的 deep-link 真实交互回归：
 *   1. 直接打开 /workspace/:id → 选中 URL 指定的 workspace（而非默认第一个）
 *   2. 点击已有 session → 真实触发 GET /api/messages 拉取消息
 *   3. @架构师发送 → 仍走 POST /api/chat（不退回 /api/messages）
 *   4. reload 后 session/message 持久化
 *
 * P0 harness 边界同 role-chat-core：无 Redis/runtime worker，public_cloud chat
 * 仅断言 user message 持久化与 deep-link 选中，agent 回复流断言 deferred。
 */
test.describe('WEB-WORKSPACE-UX deep-link 真实交互', () => {
  let storageState: string

  test.beforeAll(async () => {
    storageState = await ensureP0StorageState()
  })

  test('直接打开 /workspace/:id → 选中正确 workspace → 点击 session 拉消息 → @架构师走 /api/chat → reload 保留', async ({ browser }) => {
    const context = await browser.newContext({ storageState })
    const page = await context.newPage()

    // 真实创建两个 workspace；deep-link 目标取第二个，验证 URL 不被默认第一个覆盖
    const ts = Date.now()
    const mk = async (name: string) => {
      const res = await page.request.post('/api/workspaces', {
        data: { name, execution_domain: 'cloud' },
      })
      expect(res.ok()).toBeTruthy()
      return (await res.json()).id as string
    }
    const ws1Name = `E2E-WSUX-A-${ts}`
    const ws2Name = `E2E-WSUX-B-${ts}`
    await mk(ws1Name)
    const ws2Id = await mk(ws2Name)

    // deep-link 直接打开第二个 workspace
    await page.goto(`/workspace/${ws2Id}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByTestId('workspace-shell')).toBeVisible()

    // 断言 URL 指定 workspace 被选中：Sidebar 切换器显示 ws2 名称（activeWorkspaceId===ws2Id），
    // 即使 ws2 不是列表第一个，也不被默认覆盖（修复核心断言）。
    await expect(page.getByTestId('workspace-switcher')).toHaveText(new RegExp(ws2Name), { timeout: 10000 })

    // 新建会话，使其落库并产生可点击的 session 项
    await page.getByRole('button', { name: '新建会话' }).click()
    await expect(page.getByTestId('session-list')).toBeVisible()

    // @架构师发送一条消息（经 /api/chat 真实持久化），为 fetchMessages 断言准备历史
    await page.getByRole('button', { name: '提及角色' }).click()
    const picker = page.getByTestId('role-picker')
    await expect(picker).toBeVisible()
    await picker.getByText('@架构师').click()
    const msg = `WSUX-ASK-${ts}`
    await page.getByPlaceholder(/输入消息/).fill(msg)
    await page.getByRole('button', { name: /发送/ }).click()
    await page.waitForResponse((r) => r.url().includes('/api/chat') && r.request().method() === 'POST')

    // 点击 session-list 中已有 session → 必须真实触发 GET /api/messages（setActiveSession fetchMessages 修复点）
    const sessionBtn = page.getByTestId('session-list').locator('button').first()
    const [msgRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/messages') && r.request().method() === 'GET'),
      sessionBtn.click(),
    ])
    expect(msgRes.ok()).toBeTruthy()

    // 布局/视觉断言（拒绝仅 toBeVisible）：三栏不重叠 + 无横向滚动
    await assertNoHorizontalScroll(page)
    await assertNoElementOverlap(page, '[data-testid="workspace-shell"] > *')

    // reload 后消息从 DB 重新加载持久化。agent 回复现也落库（FakeExecutor 回显问题文本），
    // 故按用户气泡(.bg-primary/10)精确定位用户消息，避免与 agent 回显文本串味。
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('.bg-primary\\/10', { hasText: msg })).toBeVisible({ timeout: 10000 })

    await context.close()
  })
})
