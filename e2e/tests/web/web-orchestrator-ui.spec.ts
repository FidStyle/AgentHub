import { test, expect } from '../fixtures'

// WEB-ORCHESTRATOR-UI-001 / PRGA-004：Web 编排 UI 真实链路 E2E。
// 用真实 /api/plans + /api/actions 播种数据（authed context，非 mock），打开 workspace 编排 tab，
// 断言 PlanCard/ActionCard 渲染，点批准触发真实 /api/actions/:id/approve，重新读取断言状态持久。
//
// 需真实 DB session（TEST_AUTH_COOKIE / TEST_AUTH_STORAGE_STATE）+ 已有 workspace+session。
// 缺失时 test.skip 并标注 DEFERRED（与 REG-20260531-010 GUI/DB DEFERRED 一致），不删断言糊弄。

const hasAuth = !!(process.env.TEST_AUTH_COOKIE || process.env.TEST_AUTH_COOKIE_VALUE || process.env.TEST_AUTH_STORAGE_STATE)

test.describe('WEB 编排 UI 真实链路（PRGA-004）', () => {
  test.skip(!hasAuth,
    'DEFERRED：需 TEST_AUTH_COOKIE（真实 DB），CI 无真实 Supabase 时跳过')

  test('播种真实 plan/action → 编排 tab 渲染卡片 → 批准调真实 API → 状态持久', async ({ authedPage: page }) => {
    const ts = Date.now()
    const firstNodeId = crypto.randomUUID()
    const secondNodeId = crypto.randomUUID()
    const wsResp = await page.request.post('/api/workspaces', {
      data: { name: `E2E-ORCH-${ts}`, execution_domain: 'cloud' },
    })
    expect(wsResp.ok()).toBeTruthy()
    const workspaceId = (await wsResp.json()).id as string

    const sessionResp = await page.request.post('/api/sessions', {
      data: { workspace_id: workspaceId, name: 'E2E 编排会话' },
    })
    expect(sessionResp.ok()).toBeTruthy()
    const sessionId = (await sessionResp.json()).id as string

    // 1) 真实 API 播种：一个待确认计划 + 一个高风险待审批动作
    const planResp = await page.request.post('/api/plans', {
      data: {
        session_id: sessionId,
        title: 'E2E 编排计划',
        nodes: [
          { id: firstNodeId, label: '步骤一' },
          { id: secondNodeId, label: '步骤二', depends_on: [firstNodeId] },
        ],
      },
    })
    expect(planResp.ok()).toBeTruthy()

    const actionResp = await page.request.post('/api/actions', {
      data: { session_id: sessionId, action_type: 'deploy', command: 'deploy production --force' },
    })
    expect(actionResp.ok()).toBeTruthy()
    const action = await actionResp.json()
    expect(action.risk_level).toBe('high')
    expect(action.status).toBe('pending')

    // 2) 打开 workspace → 选中 session → 右栏切「变更」tab（编排面板位于变更内）
    await page.goto(`/workspace/${workspaceId}`)
    await expect(page.locator('[data-testid="workspace-shell"]')).toBeVisible()
    await page.getByTestId('session-list').getByText('E2E 编排会话').click()
    await page.locator('button', { hasText: '变更' }).click()

    const panel = page.locator('[data-testid="orchestrator-panel"]')
    await expect(panel).toBeVisible()

    // 3) 深度断言：PlanCard 标题/节点 + ActionCard 命令/风险/审批按钮
    await expect(panel.getByText('E2E 编排计划')).toBeVisible()
    await expect(panel.getByText('步骤一')).toBeVisible()
    await expect(panel.getByText('deploy production --force')).toBeVisible()
    await expect(panel.getByText('风险 高')).toBeVisible()
    const approveBtn = panel.locator('button', { hasText: '授权本次' })
    await expect(approveBtn).toBeVisible()

    // 4) 点批准 → 断言真实 /api/actions/:id/approve 被调
    const approveCall = page.waitForResponse(
      (r) => r.url().includes(`/api/actions/${action.id}/approve`) && r.request().method() === 'POST',
    )
    await approveBtn.click()
    const approveRes = await approveCall
    expect(approveRes.ok()).toBeTruthy()

    // 5) 状态持久：重新通过真实 API 读取，断言 approved
    const verify = await page.request.get(`/api/actions?session_id=${sessionId}`)
    const list = await verify.json()
    const persisted = list.find((a: { id: string }) => a.id === action.id)
    expect(persisted.status).toBe('approved')
  })
})
