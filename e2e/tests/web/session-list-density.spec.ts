import { test, expect } from '@playwright/test'
import { ensureAcceptanceStorageState } from '../../helpers/auth-state'
import { assertNoHorizontalScroll } from '../../helpers/visual-assertions'

const ARTIFACT_DIR = 'e2e/artifacts/session-list-density'

async function seedWorkspace(page: import('@playwright/test').Page) {
  const ts = Date.now()
  const res = await page.request.post('/api/workspaces', {
    data: { name: `E2E-SESSION-DENSITY-${ts}`, execution_domain: 'cloud' },
  })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).id as string
}

test.describe('会话列表紧凑布局', () => {
  let storageState: string
  test.beforeAll(async () => {
    storageState = await ensureAcceptanceStorageState()
  })

  test('新会话和新建群聊入口语义区分，列表项保持 IM 密度', async ({ browser }) => {
    const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()

    const wsId = await seedWorkspace(page)
    await page.goto(`/workspace/${wsId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByTestId('workspace-shell')).toBeVisible()

    await page.getByTestId('new-session-btn').click()
    await expect(page.getByTestId('new-session-btn')).toHaveAttribute('aria-label', '新建会话')
    await expect(page.getByTestId('new-group-conversation')).toHaveAttribute('aria-label', '新建群聊')
    await expect(page.getByTestId('new-group-conversation')).toHaveAttribute('title', '新建群聊')

    const firstSessionItem = page.getByTestId('session-list').locator('[data-testid^="session-list-item-"]').first()
    await expect(firstSessionItem).toBeVisible({ timeout: 10000 })

    const box = await firstSessionItem.boundingBox()
    expect(box, '会话列表项必须有 bounding box').not.toBeNull()
    expect(box!.height, '会话列表项应接近 IM 两行密度').toBeLessThanOrEqual(58)

    const overflow = await page.getByTestId('session-list').evaluate((node) => node.scrollWidth > node.clientWidth + 1)
    expect(overflow, '会话列表不应横向溢出').toBe(false)
    await assertNoHorizontalScroll(page)

    await page.screenshot({ path: `${ARTIFACT_DIR}/desktop-session-list-density.png`, fullPage: false })
    await context.close()
  })
})
