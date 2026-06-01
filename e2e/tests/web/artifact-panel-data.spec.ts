import { test, expect } from '../fixtures'

// ARTIFACT-PANEL-DATA-001 / PRGA-005：Web ArtifactPanel 真实数据 E2E。
// 用真实 /api/role-agents + /api/sessions + /api/messages 播种数据（authed context，非 mock），
// 打开 workspace 切角色/产物 tab，断言与真实 API/DB 一致；空态为真实数据为空，非硬编码。
//
// 需真实 DB session（TEST_AUTH_COOKIE / TEST_AUTH_STORAGE_STATE）+ 已有 workspace。
// 缺失时 test.skip 并标注 DEFERRED（与 REG-20260531-010 GUI/DB DEFERRED 一致），不删断言糊弄。

const hasAuth = !!(process.env.TEST_AUTH_COOKIE || process.env.TEST_AUTH_COOKIE_VALUE || process.env.TEST_AUTH_STORAGE_STATE)

test.describe('ARTIFACT-PANEL 真实数据（PRGA-005）', () => {
  test.skip(!hasAuth,
    'DEFERRED：需 TEST_AUTH_COOKIE（真实 DB），CI 无真实 Supabase 时跳过')

  test('播种真实 role agent/session → 角色 Tab 渲染真实数据，产物空态为真实空', async ({ authedPage: page }) => {
    const ts = Date.now()
    const wsResp = await page.request.post('/api/workspaces', {
      data: { name: `E2E-ARTIFACT-DATA-${ts}`, execution_domain: 'cloud' },
    })
    expect(wsResp.ok()).toBeTruthy()
    const workspaceId = (await wsResp.json()).id as string

    // 1) 真实 API 播种：role agent + session
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

    // 2) 打开 workspace
    await page.goto(`/workspace/${workspaceId}`)
    await expect(page.locator('[data-testid="workspace-shell"]')).toBeVisible()

    // 3) Role Agents 位于「角色」tab：断言播种的 role agent 名称（非 toBeVisible 糊弄）
    await page.locator('button', { hasText: '角色' }).click()
    const agentsPanel = page.locator('[data-testid="artifact-agents"]')
    await expect(agentsPanel).toBeVisible()
    await expect(agentsPanel.getByRole('button', { name: new RegExp(`^E2E 测试工程师 ${ts}`) })).toBeVisible()
    // 交叉校验真实 API
    const agentsApi = await page.request.get(`/api/role-agents?workspace_id=${workspaceId}`)
    const agentsList = await agentsApi.json()
    expect(agentsList.some((a: { id: string }) => a.id === agent.id)).toBeTruthy()

    // 4) 产物 tab：无 durable artifact 时是真实空态，不从 message_type 假装产物。
    await page.getByTestId('artifact-panel').getByRole('button', { name: '产物' }).click()
    await expect(page.getByText('暂无产物')).toBeVisible()
  })
})
