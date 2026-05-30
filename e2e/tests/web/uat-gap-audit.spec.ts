import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { ensureP0StorageState } from '../../helpers/auth-state'

/**
 * PRODUCT-UAT-GAP-AUDIT-001 — 只读真实浏览器审计（不修复、不断言已知答案）。
 *
 * 在真实 DB + 真实 auth + 默认 dev:web（无 RUNTIME_E2E worker = 真实用户环境）下，
 * 观察并记录每条主链路用户是否真正达成目标，而不是只看 API 是否 200 / 按钮是否可见。
 * 本 spec 是审计证据采集器（除环境前置外不 fail），把观察写入 scratchpad 供报告汇总。
 */
const OUT = path.resolve(__dirname, '../../../.workflow/.scratchpad/uat-gap-audit')
const findings: Record<string, unknown>[] = []
function record(id: string, data: Record<string, unknown>) {
  findings.push({ id, ...data })
}

test.describe('UAT 缺口审计（真实浏览器 / 真实 DB / 无 worker = 真实用户态）', () => {
  let storageState: string

  test.beforeAll(async () => {
    storageState = await ensureP0StorageState()
    if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })
  })

  test.afterAll(async () => {
    fs.writeFileSync(
      path.join(OUT, 'browser-findings.json'),
      JSON.stringify({ runtime_e2e: process.env.RUNTIME_E2E ?? '0', findings }, null, 2),
    )
  })

  test('cloud workspace：@架构师发送后用户能否看到真实回复', async ({ browser }) => {
    const context = await browser.newContext({ storageState })
    const page = await context.newPage()
    const ts = Date.now()

    const res = await page.request.post('/api/workspaces', {
      data: { name: `AUDIT-${ts}`, execution_domain: 'cloud' },
    })
    const wsId = (await res.json()).id as string
    record('env', { workspace_create_status: res.status(), wsId })

    await page.goto(`/workspace/${wsId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByTestId('workspace-shell')).toBeVisible()

    await page.getByRole('button', { name: '新建会话' }).click()
    await page.waitForTimeout(1000)

    await page.getByRole('button', { name: '提及角色' }).click()
    const picker = page.getByTestId('role-picker')
    await picker.waitFor({ state: 'visible' }).catch(() => {})
    const architect = picker.getByText('@架构师')
    const hasArchitect = await architect.count()
    record('role-picker', { architect_visible: hasArchitect > 0 })
    if (hasArchitect > 0) await architect.first().click()

    const chatResp = page.waitForResponse((r) => r.url().includes('/api/chat'), { timeout: 15000 })
    const msg = `AUDIT-ASK-${ts}`
    await page.getByPlaceholder(/输入消息/).fill(msg)
    await page.getByRole('button', { name: /发送/ }).click()
    let chatStatus = -1
    try { chatStatus = (await chatResp).status() } catch { /* no resp */ }

    const badge = page.getByTestId('message-role-badge')
    const agentBubble = page.locator('.bg-muted p')
    let sawReply = false
    let sawNotice = false
    let noticeText = ''
    const deadline = Date.now() + 20000
    while (Date.now() < deadline) {
      if ((await badge.count()) > 0 && (await agentBubble.count()) > 0) {
        const t = (await agentBubble.first().innerText()).trim()
        if (t && !t.startsWith('⚠️')) { sawReply = true; break }
      }
      const bubbles = await agentBubble.allInnerTexts().catch(() => [])
      const notice = bubbles.find((b) => b.trim().startsWith('⚠️'))
      if (notice) { sawNotice = true; noticeText = notice.trim() }
      await page.waitForTimeout(1000)
    }

    record('cloud-architect-reply', {
      chat_http_status: chatStatus,
      user_message_visible: (await page.locator('.bg-primary\\/10', { hasText: msg }).count()) > 0,
      saw_real_agent_reply: sawReply,
      saw_runtime_notice: sawNotice,
      notice_text: noticeText,
      conclusion: sawReply
        ? '用户目标达成：看到真实回复'
        : sawNotice
          ? `技术链路有反馈但目标未达成：仅运行时不可用提示（${noticeText}）`
          : '技术链路通过(HTTP/落库)但目标未达成：等待超时，无可见回复也无提示',
    })

    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1500)
    record('reload-persistence', {
      user_msg_after_reload: (await page.locator('.bg-primary\\/10', { hasText: msg }).count()) > 0,
      agent_badge_after_reload: (await page.getByTestId('message-role-badge').count()) > 0,
    })

    await context.close()
  })

  test('artifact 面板：产物/上下文/Agents 是否呈现真实数据', async ({ browser }) => {
    const context = await browser.newContext({ storageState })
    const page = await context.newPage()
    const res = await page.request.get('/api/workspaces')
    const list = await res.json()
    const wsId = Array.isArray(list) && list[0] ? list[0].id : null
    if (!wsId) { record('artifact', { skipped: 'no workspace' }); await context.close(); return }

    await page.goto(`/workspace/${wsId}`)
    await page.waitForLoadState('domcontentloaded')
    const panel = page.getByTestId('artifact-panel')
    const panelVisible = await panel.count()
    let agentsTabText = ''
    if (panelVisible > 0) {
      await panel.getByRole('button', { name: 'Agents' }).click().catch(() => {})
      await page.waitForTimeout(500)
      agentsTabText = (await panel.innerText()).replace(/\s+/g, ' ').trim().slice(0, 200)
    }
    const ra = await page.request.get(`/api/role-agents?workspace_id=${wsId}`)
    const raCount = ra.ok() ? (await ra.json()).length : -1
    record('artifact', {
      panel_visible: panelVisible > 0,
      role_agents_api_count: raCount,
      agents_tab_text: agentsTabText,
      conclusion:
        agentsTabText.includes('暂无 Agent') && raCount > 0
          ? '技术链路有数据(role-agents API 有结果)但 Agents 面板恒显示“暂无 Agent”——面板未接数据'
          : '需人工核对',
    })
    await context.close()
  })

  test('mobile 入口：/m 是否呈现轻量主路径', async ({ browser }) => {
    const context = await browser.newContext({ storageState })
    const page = await context.newPage()
    const resp = await page.goto('/m')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)
    const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim().slice(0, 300)
    record('mobile-entry', {
      http_status: resp?.status() ?? -1,
      body_excerpt: bodyText,
      has_interactive: (await page.locator('button, a').count()),
    })
    await context.close()
  })
})
