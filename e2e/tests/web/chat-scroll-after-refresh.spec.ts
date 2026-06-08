import { test, expect } from '@playwright/test'
import { ensureAcceptanceStorageState } from '../../helpers/auth-state'

async function seedWorkspace(page: import('@playwright/test').Page) {
  const ts = Date.now()
  const res = await page.request.post('/api/workspaces', {
    data: { name: `E2E-CHAT-SCROLL-${ts}`, execution_domain: 'cloud' },
  })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).id as string
}

async function createSession(page: import('@playwright/test').Page, workspaceId: string) {
  const res = await page.request.post('/api/sessions', {
    data: { workspace_id: workspaceId, name: '滚动验收会话' },
  })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).id as string
}

async function createMessage(page: import('@playwright/test').Page, sessionId: string, index: number) {
  const res = await page.request.post('/api/messages', {
    data: {
      session_id: sessionId,
      sender_type: index % 2 === 0 ? 'agent' : 'user',
      content: `滚动验收消息 ${index} `.repeat(4),
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
}

test.describe('聊天记录刷新后置底', () => {
  let storageState: string

  test.beforeAll(async () => {
    storageState = await ensureAcceptanceStorageState()
  })

  test('消息列表刷新后自动滚动到底部，便于继续查看执行状态', async ({ browser }) => {
    const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()

    const workspaceId = await seedWorkspace(page)
    const sessionId = await createSession(page, workspaceId)
    await page.goto(`/workspace/${workspaceId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByTestId('workspace-shell')).toBeVisible()

    for (let index = 1; index <= 36; index += 1) {
      await createMessage(page, sessionId, index)
    }

    await page.getByTestId(`session-list-item-${sessionId}`).click()
    await expect(page.getByTestId('chat-message').last()).toContainText('滚动验收消息 36')

    const list = page.getByTestId('message-list-scroll')
    await list.evaluate((node) => {
      node.scrollTop = 0
    })
    await expect.poll(async () => list.evaluate((node) => node.scrollTop)).toBeLessThanOrEqual(2)

    const [messagesRes] = await Promise.all([
      page.waitForResponse((response) => response.url().includes('/api/messages') && response.request().method() === 'GET'),
      page.getByTestId(`session-list-item-${sessionId}`).click(),
    ])
    expect(messagesRes.ok()).toBeTruthy()

    await expect.poll(async () => list.evaluate((node) => {
      const bottom = node.querySelector('[data-testid="message-list-bottom"]')
      if (!bottom) return false
      const listBox = node.getBoundingClientRect()
      const bottomBox = bottom.getBoundingClientRect()
      return bottomBox.bottom <= listBox.bottom + 1 && bottomBox.top >= listBox.top - 1
    })).toBe(true)

    await page.screenshot({ path: 'e2e/artifacts/chat-scroll-after-refresh/desktop-bottom-after-refresh.png', fullPage: false })
    await context.close()
  })
})
