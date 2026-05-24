import { test, expect } from './fixtures'

test.describe('消息发送与渲染', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.route('**/api/sessions?workspace_id=ws-1', (route) =>
      route.fulfill({ json: [{ id: 'sess-1', name: '测试会话', workspace_id: 'ws-1' }] }),
    )
    await page.route('**/api/role-agents?workspace_id=ws-1', (route) =>
      route.fulfill({ json: [] }),
    )
    await page.route('**/api/messages?session_id=sess-1', (route) =>
      route.fulfill({ json: [] }),
    )
  })

  test('创建会话并发送消息', async ({ authedPage: page }) => {
    let msgCount = 0
    await page.route('**/api/messages', (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON()
        msgCount++
        return route.fulfill({
          status: 201,
          json: {
            id: `msg-${msgCount}`,
            session_id: body.session_id,
            content: body.content,
            sender_type: 'user',
            message_type: 'text',
            streaming_status: 'complete',
            is_pinned: false,
            created_at: new Date().toISOString(),
          },
        })
      }
      return route.continue()
    })

    await page.route('**/api/chat', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"你好！我是 Agent。","done":true}\n\n',
      }),
    )

    await page.goto('/workspace/ws-1')
    // 页面自动选中第一个 session
    await expect(page.getByText('测试会话')).toBeVisible()

    // 发送消息
    const input = page.getByPlaceholder('Input message...')
    await input.fill('你好')
    await page.getByRole('button', { name: 'Send' }).click()

    // 用户消息出现
    await expect(page.locator('.bg-blue-500').getByText('你好')).toBeVisible()
  })

  test('新建会话按钮创建新会话', async ({ authedPage: page }) => {
    await page.route('**/api/sessions', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          json: { id: 'sess-new', name: '新会话', workspace_id: 'ws-1' },
        })
      }
      return route.continue()
    })
    await page.route('**/api/messages?session_id=sess-new', (route) =>
      route.fulfill({ json: [] }),
    )

    await page.goto('/workspace/ws-1')
    await expect(page.getByText('测试会话')).toBeVisible()

    await page.getByRole('button', { name: '新建', exact: true }).click()
    await expect(page.getByText('新会话')).toBeVisible()
  })
})
