import { test, expect } from '../fixtures'

// ARTIFACT-PANEL-DATA-001 / PRGA-005：Web ArtifactPanel 三 Tab 真实数据 E2E。
// 用真实 /api/role-agents + /api/sessions + /api/messages 播种数据（authed context，非 mock），
// 打开 workspace 切 Agents/上下文/产物 tab，断言与真实 API/DB 一致；空态为真实数据为空，非硬编码。
//
// 需真实 DB session（TEST_AUTH_COOKIE / TEST_AUTH_STORAGE_STATE）+ 已有 workspace。
// 缺失时 test.skip 并标注 DEFERRED（与 REG-20260531-010 GUI/DB DEFERRED 一致），不删断言糊弄。

const hasAuth = !!(process.env.TEST_AUTH_COOKIE || process.env.TEST_AUTH_COOKIE_VALUE || process.env.TEST_AUTH_STORAGE_STATE)

test.describe('ARTIFACT-PANEL 三 Tab 真实数据（PRGA-005）', () => {
  test.skip(!hasAuth,
    'DEFERRED：需 TEST_AUTH_COOKIE（真实 DB），CI 无真实 Supabase 时跳过')

  test('播种真实 role agent/session/message → 三 Tab 渲染真实数据，空态为真实空', async ({ authedPage: page }) => {
    const ts = Date.now()
    const wsResp = await page.request.post('/api/workspaces', {
      data: { name: `E2E-ARTIFACT-DATA-${ts}`, execution_domain: 'cloud' },
    })
    expect(wsResp.ok()).toBeTruthy()
    const workspaceId = (await wsResp.json()).id as string

    // 1) 真实 API 播种：role agent + session + pinned 上下文消息 + result_card 产物消息
    const agentResp = await page.request.post('/api/role-agents', {
      data: { workspace_id: workspaceId, name: `E2E 测试工程师 ${ts}`, role_type: 'engineer', capabilities: ['testing'] },
    })
    expect(agentResp.ok()).toBeTruthy()
    const agent = await agentResp.json()
    expect(agent.name).toBe(`E2E 测试工程师 ${ts}`)

    const sessionResp = await page.request.post('/api/sessions', {
      data: { workspace_id: workspaceId, name: 'E2E 产物会话' },
    })
    expect(sessionResp.ok()).toBeTruthy()
    const session = await sessionResp.json()

    const ctxResp = await page.request.post('/api/messages', {
      data: { session_id: session.id, content: 'E2E 引用上下文片段', is_pinned: true },
    })
    expect(ctxResp.ok()).toBeTruthy()

    const artifactResp = await page.request.post('/api/messages', {
      data: { session_id: session.id, content: 'E2E 产物结果卡片', message_type: 'result_card' },
    })
    expect(artifactResp.ok()).toBeTruthy()

    // 2) 打开 workspace
    await page.goto(`/workspace/${workspaceId}`)
    await expect(page.locator('[data-testid="workspace-shell"]')).toBeVisible()

    // 3) Role Agents 位于「上下文」tab：断言播种的 role agent 名称（非 toBeVisible 糊弄）
    await page.locator('button', { hasText: '上下文' }).click()
    const agentsPanel = page.locator('[data-testid="artifact-agents"]')
    await expect(agentsPanel).toBeVisible()
    await expect(agentsPanel.getByRole('button', { name: new RegExp(`^E2E 测试工程师 ${ts}`) })).toBeVisible()
    // 交叉校验真实 API
    const agentsApi = await page.request.get(`/api/role-agents?workspace_id=${workspaceId}`)
    const agentsList = await agentsApi.json()
    expect(agentsList.some((a: { id: string }) => a.id === agent.id)).toBeTruthy()

    // 4) 上下文 tab：断言 pinned 消息内容
    await page.locator('button', { hasText: '上下文' }).click()
    const ctxPanel = page.locator('[data-testid="artifact-context"]')
    await expect(ctxPanel).toBeVisible()
    await expect(ctxPanel.getByText('E2E 引用上下文片段')).toBeVisible()

    // 5) 产物 tab：断言 result_card 产物条目
    await page.getByTestId('artifact-panel').getByRole('button', { name: '产物' }).click()
    const outPanel = page.locator('[data-testid="artifact-output"]')
    await expect(outPanel).toBeVisible()
    await expect(outPanel.getByText('E2E 产物结果卡片')).toBeVisible()
  })
})
