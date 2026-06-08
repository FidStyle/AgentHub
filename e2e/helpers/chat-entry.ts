import { expect, type Page } from '@playwright/test'

export async function openOrchestratorDirectChat(page: Page) {
  const orchestrator = page.getByTestId('session-list').getByRole('button', { name: /打开 (架构师|Orchestrator)/ }).first()
  await expect(orchestrator).toBeVisible({ timeout: 10000 })
  await orchestrator.click()
  await expect(page.getByTestId('composer-input')).toBeEnabled({ timeout: 10000 })
}

export async function createAndOpenGroupChat(page: Page, workspaceId: string, name = `E2E 群聊 ${Date.now()}`) {
  const rolesRes = await page.request.get(`/api/role-agents?workspace_id=${workspaceId}`)
  expect(rolesRes.ok()).toBeTruthy()
  const roles = await rolesRes.json() as Array<{ id: string; name: string }>
  expect(roles.length).toBeGreaterThan(0)

  const groupRes = await page.request.post('/api/conversations/groups', {
    data: {
      workspace_id: workspaceId,
      name,
      participant_role_agent_ids: roles.slice(0, 2).map((role) => role.id),
    },
  })
  expect(groupRes.ok(), await groupRes.text()).toBeTruthy()
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  const sidebarVisible = await page.getByTestId('session-list').isVisible().catch(() => false)
  if (!sidebarVisible) {
    await page.getByTestId('open-sidebar').click()
    await expect(page.getByTestId('session-list')).toBeVisible({ timeout: 10000 })
  }
  const group = page.getByTestId('session-list').getByRole('button', { name: new RegExp(`打开 ${name}`) }).first()
  await expect(group).toBeVisible({ timeout: 10000 })
  await group.click()
  await expect(page.getByTestId('composer-input')).toBeEnabled({ timeout: 10000 })
}
