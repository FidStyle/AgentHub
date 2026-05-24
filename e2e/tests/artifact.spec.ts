import { test, expect } from './fixtures'

test.describe('Artifact 卡片渲染', () => {
  const mockMessages = [
    {
      id: 'msg-plan',
      session_id: 'sess-1',
      sender_type: 'agent',
      message_type: 'plan_card',
      content: '实现用户登录功能',
      metadata: { steps: ['分析需求', '编写代码', '测试验证'] },
      is_pinned: false,
      streaming_status: 'complete',
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'msg-result',
      session_id: 'sess-1',
      sender_type: 'agent',
      message_type: 'result_card',
      content: '登录功能已完成',
      metadata: { status: 'success' },
      is_pinned: false,
      streaming_status: 'complete',
      created_at: '2026-01-01T00:01:00Z',
    },
    {
      id: 'msg-text',
      session_id: 'sess-1',
      sender_type: 'agent',
      message_type: 'text',
      content: '# Hello\n\n```ts\nconst x = 1\n```',
      metadata: null,
      is_pinned: false,
      streaming_status: 'complete',
      created_at: '2026-01-01T00:02:00Z',
    },
  ]

  test.beforeEach(async ({ authedPage: page }) => {
    await page.route('**/api/sessions?workspace_id=ws-1', (route) =>
      route.fulfill({ json: [{ id: 'sess-1', name: '测试会话', workspace_id: 'ws-1' }] }),
    )
    await page.route('**/api/messages?session_id=sess-1', (route) =>
      route.fulfill({ json: mockMessages }),
    )
    await page.route('**/api/role-agents?workspace_id=ws-1', (route) =>
      route.fulfill({ json: [] }),
    )
  })

  test('Plan 卡片渲染步骤列表', async ({ authedPage: page }) => {
    await page.goto('/workspace/ws-1')

    await expect(page.getByText('Plan')).toBeVisible()
    await expect(page.getByText('实现用户登录功能')).toBeVisible()
    await expect(page.getByText('分析需求')).toBeVisible()
    await expect(page.getByText('编写代码')).toBeVisible()
  })

  test('Result 卡片渲染状态', async ({ authedPage: page }) => {
    await page.goto('/workspace/ws-1')

    await expect(page.getByText('Result')).toBeVisible()
    await expect(page.getByText('登录功能已完成')).toBeVisible()
    await expect(page.getByText('success')).toBeVisible()
  })

  test('Markdown 消息渲染代码块', async ({ authedPage: page }) => {
    await page.goto('/workspace/ws-1')

    await expect(page.getByText('Hello')).toBeVisible()
    await expect(page.locator('code').getByText('const x = 1')).toBeVisible()
  })

  test('点击消息显示 Artifact 详情面板', async ({ authedPage: page }) => {
    await page.goto('/workspace/ws-1')

    // 点击 plan_card 消息
    await page.getByText('实现用户登录功能').click()

    // DetailPanel 应展示消息详情
    await expect(page.getByText('Artifact Detail')).toBeVisible()
    await expect(page.getByText('plan_card')).toBeVisible()
  })
})
