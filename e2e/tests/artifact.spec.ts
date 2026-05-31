import { test, expect } from './fixtures'

// TEST-REALITY-GATE-001 (REG-20260531-011 / PRGA-007) G1：artifact.spec.ts 接真实 API/DB。
//
// 修复前：全程 page.route 伪造 sessions/messages/role-agents，且断言的 Plan/Result/Artifact Detail
// 文案与真实 ArtifactPanel 不符（产品早已改为 fetch 真实数据），测试 green 但产品空壳；
// 更致命的是该文件位于 tests/ 根目录，不在任何 playwright project 的 testMatch 内——从不执行。
//
// 修复后：用真实 /api/role-agents + /api/sessions + /api/messages 播种（authed context，非 mock），
// 打开 workspace 切 Agents/上下文/产物三 Tab，断言渲染与真实 API/DB 一致（非 toBeVisible 糊弄）。
// 缺真实 DB session（TEST_AUTH_COOKIE / TEST_AUTH_STORAGE_STATE）时显式 test.skip 并标 DEFERRED。

const hasAuth = !!(process.env.TEST_AUTH_COOKIE || process.env.TEST_AUTH_COOKIE_VALUE || process.env.TEST_AUTH_STORAGE_STATE)

test.describe('Artifact 三 Tab 真实数据（PRGA-007）', () => {
  test.skip(!hasAuth, 'DEFERRED：需真实 DB session（TEST_AUTH_COOKIE/TEST_AUTH_STORAGE_STATE），CI 无真实 Supabase 时跳过')

  test('真实播种 role agent / session / 上下文 / 产物 → 三 Tab 断言真实数据一致', async ({ authedPage: page }) => {
    const ts = Date.now()

    // 真实创建 workspace（不依赖固定 TEST_WORKSPACE_ID，自给自足）
    const wsResp = await page.request.post('/api/workspaces', {
      data: { name: `E2E-ARTIFACT-${ts}`, execution_domain: 'cloud' },
    })
    expect(wsResp.ok()).toBeTruthy()
    const workspaceId = (await wsResp.json()).id as string

    // 真实播种：role agent + session + pinned 上下文消息 + result_card 产物消息
    const agentResp = await page.request.post('/api/role-agents', {
      data: { workspace_id: workspaceId, name: `E2E 测试工程师 ${ts}`, role_type: 'engineer', capabilities: ['testing'] },
    })
    expect(agentResp.ok()).toBeTruthy()
    const agent = await agentResp.json()

    const sessionResp = await page.request.post('/api/sessions', {
      data: { workspace_id: workspaceId, name: 'E2E 产物会话' },
    })
    expect(sessionResp.ok()).toBeTruthy()
    const session = await sessionResp.json()

    const ctxText = `E2E 引用上下文片段 ${ts}`
    const ctxResp = await page.request.post('/api/messages', {
      data: { session_id: session.id, content: ctxText, is_pinned: true },
    })
    expect(ctxResp.ok()).toBeTruthy()

    const artifactText = `E2E 产物结果卡片 ${ts}`
    const artifactResp = await page.request.post('/api/messages', {
      data: { session_id: session.id, content: artifactText, message_type: 'result_card' },
    })
    expect(artifactResp.ok()).toBeTruthy()

    // 打开真实 workspace（右栏 ArtifactPanel 默认展开）。
    // 等 /api/role-agents 响应回来，证明 Sidebar 已据 URL 设好 activeWorkspaceId（消除直接 deep-link
    // 时 store 异步未就绪、AgentsTab 仍渲染「未选择工作区」空态的竞态）。
    await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/api/role-agents?workspace_id=${workspaceId}`)),
      page.goto(`/workspace/${workspaceId}`),
    ])
    await expect(page.getByTestId('workspace-shell')).toBeVisible()
    const panel = page.getByTestId('artifact-panel')
    await expect(panel).toBeVisible()

    // Role Agents 位于「上下文」Tab：断言播种的 role agent 名称 + 交叉校验真实 API（非 toBeVisible 糊弄）。
    await panel.getByRole('button', { name: '上下文' }).click()
    const agentsPanel = page.getByTestId('artifact-agents')
    await expect(agentsPanel).toBeVisible({ timeout: 10000 })
    // 定位 agent 列表项按钮（其无障碍名以 agent 名开头）；bare getByText 会同时命中详情面板
    // 同名 div + 系统提示词 prose，触发 strict-mode 冲突。
    await expect(agentsPanel.getByRole('button', { name: new RegExp(`^E2E 测试工程师 ${ts}`) })).toBeVisible()
    const agentsApi = await (await page.request.get(`/api/role-agents?workspace_id=${workspaceId}`)).json()
    expect(agentsApi.some((a: { id: string }) => a.id === agent.id)).toBeTruthy()

    // 选中会话（上下文/产物 Tab 依赖 activeSessionId）；用 session-list 内按钮精确定位，
    // 避免与 chat-panel 顶部同名 heading 串味（strict mode）。
    await page.getByTestId('session-list').getByText('E2E 产物会话').click()

    // 上下文 Tab：断言 pinned 消息内容真实渲染
    await panel.getByRole('button', { name: '上下文' }).click()
    const ctxPanel = page.getByTestId('artifact-context')
    await expect(ctxPanel).toBeVisible()
    await expect(ctxPanel.getByText(ctxText)).toBeVisible()

    // 产物 Tab：断言 result_card 产物条目真实渲染
    await panel.getByRole('button', { name: '产物' }).click()
    const outPanel = page.getByTestId('artifact-output')
    await expect(outPanel).toBeVisible()
    await expect(outPanel.getByText(artifactText)).toBeVisible()
  })

  test('Agents Tab 渲染真实 API 返回的角色（默认架构师自动 seed，非硬编码）', async ({ authedPage: page }) => {
    const ts = Date.now()
    const wsResp = await page.request.post('/api/workspaces', {
      data: { name: `E2E-ARTIFACT-DEFAULT-${ts}`, execution_domain: 'cloud' },
    })
    expect(wsResp.ok()).toBeTruthy()
    const workspaceId = (await wsResp.json()).id as string

    const sessionResp = await page.request.post('/api/sessions', {
      data: { workspace_id: workspaceId, name: 'E2E 默认 Agent 会话' },
    })
    expect(sessionResp.ok()).toBeTruthy()

    await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/api/role-agents?workspace_id=${workspaceId}`)),
      page.goto(`/workspace/${workspaceId}`),
    ])
    const panel = page.getByTestId('artifact-panel')
    await expect(panel).toBeVisible()

    // cloud workspace 首次取 role agents 会自动 seed 默认「架构师」orchestrator。
    // AgentsTab 必须渲染真实 API 返回的该角色（而非硬编码空壳），并与 API 交叉校验一致。
    const agentsApi = await (await page.request.get(`/api/role-agents?workspace_id=${workspaceId}`)).json()
    expect(Array.isArray(agentsApi)).toBeTruthy()
    expect(agentsApi.some((a: { name: string }) => a.name === '架构师')).toBeTruthy()

    await panel.getByRole('button', { name: '上下文' }).click()
    await page.getByTestId('session-list').getByText('E2E 默认 Agent 会话').click()
    const agentsPanel = page.getByTestId('artifact-agents')
    await expect(agentsPanel).toBeVisible({ timeout: 10000 })
    // 架构师 名同时出现在列表项按钮、详情面板与系统提示词 prose 中；定位列表项按钮
    // （无障碍名以「架构师」开头）以唯一命中真实渲染的 agent 行。
    await expect(agentsPanel.getByRole('button', { name: /^架构师/ })).toBeVisible()
  })
})
