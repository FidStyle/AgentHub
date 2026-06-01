import { test, expect } from './fixtures'

// TEST-REALITY-GATE-001 (REG-20260531-011 / PRGA-009) G3：workspace.spec.ts 真实 CRUD。
//
// 修复前：全程 mock /api/workspaces（GET/POST），只 toBeVisible；空态断言 '暂无工作区'（真实文案是
// '暂无工作区，点击右上角新建'），落库/导航全无真实验证。
//
// 修复后：真实 POST 创建 workspace → 交叉校验 /api/workspaces 落库 → 列表渲染该项 → 点击导航进工作台。
// 断言全部 self-scoped 到本测试创建的唯一命名 workspace，绝不依赖共享 DB 的 list[0]/全局空态
// （共享 P0 测试用户的列表会被并行/历史用例污染，全局断言天然 flaky）。
// 缺真实 DB session 时显式 test.skip 并标 DEFERRED。

const hasAuth = !!(process.env.TEST_AUTH_COOKIE || process.env.TEST_AUTH_COOKIE_VALUE || process.env.TEST_AUTH_STORAGE_STATE)

test.describe('工作区真实 CRUD（PRGA-009）', () => {
  test.skip(!hasAuth, 'DEFERRED：需真实 DB session（TEST_AUTH_COOKIE/TEST_AUTH_STORAGE_STATE），CI 无真实 Supabase 时跳过')

  test('UI 新建工作区 → 真实落库 → 列表渲染 → 点击导航进工作台', async ({ authedPage: page }) => {
    const ts = Date.now()
    const wsName = `E2E-WS-CRUD-${ts}`

    await page.goto('/workspace')
    await expect(page.getByRole('heading', { name: '我的工作区' })).toBeVisible()

    // UI 真实创建（走真实 POST /api/workspaces）
    await page.getByRole('button', { name: '新建工作区' }).click()
    await expect(page.getByPlaceholder('输入工作区名称')).toBeVisible()
    await page.getByPlaceholder('输入工作区名称').fill(wsName)
    await page.getByRole('button', { name: '创建', exact: true }).click()

    // Dialog 关闭后会直接进入工作台；交叉校验真实 /api/workspaces 落库。
    await expect(page.getByPlaceholder('输入工作区名称')).not.toBeVisible()

    const list = await (await page.request.get('/api/workspaces')).json()
    const created = list.find((w: { name: string }) => w.name === wsName)
    expect(created).toBeTruthy()
    expect(created.id).toBeTruthy()

    await page.waitForURL(`**/workspace/${created.id}`, { timeout: 10000 })
    await expect(page.getByTestId('workspace-shell')).toBeVisible()
  })

  test('API 创建的工作区出现在真实列表页（落库一致性，非 mock 空态）', async ({ authedPage: page }) => {
    const ts = Date.now()
    const wsName = `E2E-WS-LIST-${ts}`

    // 经真实 API 创建，再在列表页断言其渲染——验证列表读取真实 DB，而非旧 mock 伪造数据。
    const createResp = await page.request.post('/api/workspaces', {
      data: { name: wsName, execution_domain: 'cloud' },
    })
    expect(createResp.ok()).toBeTruthy()
    const created = await createResp.json() as { id: string }

    await page.goto('/workspace')
    await expect(page.getByRole('heading', { name: '我的工作区' })).toBeVisible()
    // 列表已渲染真实数据：本测试创建的工作区可见（滚入视口避免长列表 off-screen），空态文案不出现。
    const card = page.getByTestId(`workspace-card-${created.id}`)
    await expect(card).toBeAttached({ timeout: 10000 })
    await card.scrollIntoViewIfNeeded()
    await expect(card).toBeVisible()
    await expect(card.getByText(wsName)).toBeVisible()
    await expect(page.getByText('暂无工作区，点击右上角新建')).not.toBeVisible()
  })
})
