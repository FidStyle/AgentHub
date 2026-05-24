import { test, expect } from './fixtures'

test.describe('工作区 CRUD', () => {
  test('显示工作区列表页并创建新工作区', async ({ authedPage: page }) => {
    const workspaces = [
      { id: 'ws-1', name: '测试工作区', description: '描述', execution_domain: 'cloud', created_at: '2026-01-01' },
    ]

    await page.route('**/api/workspaces', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: workspaces })
      }
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          json: { id: 'ws-new', name: '新工作区', description: '', execution_domain: 'cloud', created_at: '2026-01-02' },
        })
      }
    })

    await page.goto('/workspace')
    await expect(page.getByText('我的工作区')).toBeVisible()
    await expect(page.getByText('测试工作区')).toBeVisible()

    // 创建新工作区
    await page.getByText('新建工作区').click()
    await expect(page.getByText('新建工作区').nth(1)).toBeVisible()

    await page.getByPlaceholder('输入工作区名称').fill('新工作区')
    await page.getByRole('button', { name: '创建' }).click()

    // Dialog 关闭后列表刷新
    await expect(page.getByPlaceholder('输入工作区名称')).not.toBeVisible()
  })

  test('工作区列表为空时显示提示', async ({ authedPage: page }) => {
    await page.route('**/api/workspaces', (route) => route.fulfill({ json: [] }))
    await page.goto('/workspace')
    await expect(page.getByText('暂无工作区')).toBeVisible()
  })

  test('点击工作区卡片跳转到聊天页', async ({ authedPage: page }) => {
    await page.route('**/api/workspaces', (route) =>
      route.fulfill({
        json: [{ id: 'ws-1', name: '跳转测试', description: '', execution_domain: 'cloud', created_at: '2026-01-01' }],
      }),
    )
    await page.route('**/api/sessions?workspace_id=ws-1', (route) =>
      route.fulfill({ json: [] }),
    )

    await page.goto('/workspace')
    await page.getByText('跳转测试').click()
    await page.waitForURL('**/workspace/ws-1')
  })
})
