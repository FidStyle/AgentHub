import { mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from '../fixtures'

const hasAuth = !!(process.env.TEST_AUTH_COOKIE || process.env.TEST_AUTH_COOKIE_VALUE || process.env.TEST_AUTH_STORAGE_STATE)

test.describe('Web 工作台文件、变更和产物真实链路', () => {
  test.skip(!hasAuth, 'DEFERRED：需 TEST_AUTH_COOKIE（真实 DB session）')

  test('上传文件后可预览、查看 Git diff 并保存为产物', async ({ authedPage: page }) => {
    const ts = Date.now()
    const workspaceResp = await page.request.post('/api/workspaces', {
      data: { name: `E2E-FILE-OPS-${ts}`, execution_domain: 'cloud' },
    })
    expect(workspaceResp.ok()).toBeTruthy()
    const workspace = await workspaceResp.json()

    const sessionResp = await page.request.post('/api/sessions', {
      data: { workspace_id: workspace.id, name: 'E2E 文件操作会话' },
    })
    expect(sessionResp.ok()).toBeTruthy()

    await page.goto(`/workspace/${workspace.id}`)
    await expect(page.getByTestId('workspace-shell')).toBeVisible()

    await page.getByTestId('artifact-panel').getByRole('button', { name: '文件' }).click()
    const tmpDir = path.join(os.tmpdir(), `agenthub-e2e-file-${ts}`)
    mkdirSync(tmpDir, { recursive: true })
    const filePath = path.join(tmpDir, 'e2e-file.md')
    writeFileSync(filePath, `# E2E File ${ts}\n\n- uploaded through UI\n`)
    await page.getByTestId('workspace-file-upload-input').setInputFiles(filePath)
    const uploadedFile = page.getByTestId('artifact-files').getByRole('button', { name: 'e2e-file.md' })
    await expect(uploadedFile).toBeVisible()

    await uploadedFile.click()
    await expect(page.getByTestId('workspace-markdown-preview').getByText(`E2E File ${ts}`)).toBeVisible()
    await page.getByTestId('workspace-file-preview').getByRole('button', { name: '存为产物' }).click()
    await expect(page.getByTestId('workspace-file-preview').getByText('已保存到产物')).toBeVisible()

    await page.getByTestId('artifact-panel').getByRole('button', { name: '变更' }).click()
    await expect(page.getByTestId('artifact-changes').getByText('e2e-file.md')).toBeVisible()
    await page
      .getByTestId('artifact-changes')
      .locator('.rounded-lg', { hasText: 'e2e-file.md' })
      .getByRole('button', { name: '查看 diff' })
      .click()
    await expect(page.getByTestId('git-diff-preview').getByText(`+# E2E File ${ts}`)).toBeVisible()

    await page.getByTestId('artifact-panel').getByRole('button', { name: '产物', exact: true }).click()
    await expect(page.getByTestId('artifact-output').getByText('e2e-file.md', { exact: true })).toBeVisible()
  })
})
