import { test, expect } from '../fixtures'
import { assertNoHorizontalScroll } from '../../helpers/visual-assertions'

const hasAuth = !!(process.env.TEST_AUTH_COOKIE || process.env.TEST_AUTH_COOKIE_VALUE || process.env.TEST_AUTH_STORAGE_STATE)

test.describe('Web 消息 Markdown 真实渲染', () => {
  test.skip(!hasAuth, 'DEFERRED：需真实 DB session（TEST_AUTH_COOKIE/TEST_AUTH_STORAGE_STATE）')

  test('发送 Markdown 消息后不再渲染旧 wrapper class，copy 入口仍可见', async ({ authedPage: page }) => {
    const ts = Date.now()
    const workspaceResp = await page.request.post('/api/workspaces', {
      data: { name: `E2E-MARKDOWN-${ts}`, execution_domain: 'cloud' },
    })
    expect(workspaceResp.ok()).toBeTruthy()
    const workspace = await workspaceResp.json()

    const sessionResp = await page.request.post('/api/sessions', {
      data: { workspace_id: workspace.id, name: 'E2E Markdown 会话' },
    })
    expect(sessionResp.ok()).toBeTruthy()

    await page.goto(`/workspace/${workspace.id}`)
    await expect(page.getByTestId('workspace-shell')).toBeVisible()
    await page.getByRole('button', { name: '新建会话' }).click()
    await expect(page.getByTestId('session-list')).toBeVisible()
    await page.getByTestId('session-list').getByRole('button', { name: 'E2E Markdown 会话', exact: true }).click()

    const markdownMessage = [
      `# E2E Markdown ${ts}`,
      '',
      '- 第一项',
      '- 第二项',
      '',
      '```ts',
      'const value = 1',
      '```',
    ].join('\n')

    await page.getByTestId('composer-input').fill(markdownMessage)
    await page.getByRole('button', { name: /发送/ }).click()

    const chatPanel = page.getByTestId('chat-panel')
    const markdown = chatPanel.getByTestId('message-markdown').first()
    await expect(markdown).toBeVisible({ timeout: 10000 })
    await expect(markdown).toContainText('第一项')
    await expect(markdown).toContainText('const value = 1')
    await expect(markdown.locator('.flex.shrink-0.items-center.gap-1')).toBeVisible()
    await expect(page.locator('.message-markdown-actions')).toHaveCount(0)
    await expect(markdown.getByRole('button', { name: '复制整条消息' })).toBeVisible()

    await assertNoHorizontalScroll(page)
  })
})
