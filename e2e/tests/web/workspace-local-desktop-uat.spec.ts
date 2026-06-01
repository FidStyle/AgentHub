import { test, expect } from '@playwright/test'
import { ensureP0StorageState } from '../../helpers/auth-state'
import { assertNoHorizontalScroll } from '../../helpers/visual-assertions'

test.describe('WORKSPACE-LOCAL-DESKTOP-UAT Web workspace 真实可用性', () => {
  let storageState: string

  test.beforeAll(async () => {
    storageState = await ensureP0StorageState()
  })

  test('状态栏/返回入口/附件上传/Agents CRUD/@角色同步/本地工作区门禁', async ({ browser }) => {
    test.setTimeout(60_000)
    const context = await browser.newContext({ storageState })
    const page = await context.newPage()
    const ts = Date.now()

    const cloudRes = await page.request.post('/api/workspaces', {
      data: { name: `UAT-可用工作区-${ts}`, execution_domain: 'cloud', description: 'workspace local desktop uat' },
    })
    expect(cloudRes.ok()).toBeTruthy()
    const workspace = await cloudRes.json()

    const localRes = await page.request.post('/api/workspaces', {
      data: { name: `UAT-本地门禁-${ts}`, execution_domain: 'local_desktop' },
    })
    expect(localRes.status()).toBe(409)
    expect(await localRes.json()).toMatchObject({
      error: expect.stringContaining('本地 Desktop 未连接'),
    })

    await page.goto(`/workspace/${workspace.id}`)
    await expect(page.getByTestId('workspace-shell')).toBeVisible()
    await expect(page.getByTestId('workspace-status-bar')).toBeVisible()
    await expect(page.getByTestId('workspace-user-status')).toContainText('登录')
    await expect(page.getByTestId('workspace-desktop-status')).toContainText(/Desktop：(已连接|未连接)/)
    await expect(page.getByRole('link', { name: /我的工作区/ }).first()).toHaveAttribute('href', '/workspace')

    await page.getByRole('button', { name: '新建会话' }).click()
    await expect(page.getByTestId('attachment-btn')).toBeEnabled()
    const attachmentName = `uat-attachment-${ts}.txt`
    const uploadResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/attachments') && r.request().method() === 'POST',
    )
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByTestId('attachment-btn').click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles({
      name: attachmentName,
      mimeType: 'text/plain',
      buffer: Buffer.from(`附件正文 ${ts}`),
    })
    const uploadResponse = await uploadResponsePromise
    expect(uploadResponse.ok()).toBeTruthy()
    const uploaded = await uploadResponse.json() as { id: string; name: string; preview: string }
    expect(uploaded.name).toBe(attachmentName)
    expect(uploaded.preview).toContain(`附件正文 ${ts}`)
    await expect(page.getByTestId('attachment-chips')).toContainText(attachmentName)

    const chatResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/chat') && r.request().method() === 'POST',
    )
    await page.getByPlaceholder(/输入消息/).fill(`请读取附件 ${ts}`)
    await page.getByRole('button', { name: /发送/ }).click()
    const chatResponse = await chatResponsePromise
    expect(chatResponse.ok()).toBeTruthy()
    const chatPayload = chatResponse.request().postDataJSON() as { attachmentIds?: string[] }
    expect(chatPayload.attachmentIds).toEqual([uploaded.id])

    await expect(page.getByTestId('artifact-agents')).toBeVisible()
    await page.getByTestId('agent-create-btn').click()
    await page.getByLabel('名称').fill(`UAT 工程师 ${ts}`)
    await page.getByLabel('角色类型').selectOption('engineer')
    await page.getByLabel('系统提示词').fill('你负责验证真实用户链路。')
    await page.getByLabel('能力标签').fill('uat, runtime')
    await page.getByLabel('设为编排者').check()
    await page.getByTestId('agent-save-btn').click()
    await expect(page.getByTestId('artifact-agents')).toContainText(`UAT 工程师 ${ts}`)

    await page.getByTestId('agent-edit-btn').click()
    await page.getByLabel('名称').fill(`UAT 审查者 ${ts}`)
    await page.getByTestId('agent-save-btn').click()
    await expect(page.getByTestId('artifact-agents')).toContainText(`UAT 审查者 ${ts}`)

    await page.getByRole('button', { name: '提及角色' }).click()
    await expect(page.getByTestId('role-picker')).toContainText(`@UAT 审查者 ${ts}`)
    await page.getByTestId('artifact-agents').locator('h3').click()

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByTestId('agent-delete-btn').click()
    await expect(page.getByTestId('artifact-agents')).not.toContainText(`UAT 审查者 ${ts}`)

    await assertNoHorizontalScroll(page)
    await context.close()
  })
})
