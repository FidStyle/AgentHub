import { test, expect, type Page } from '@playwright/test'
import { ensureAcceptanceStorageState } from '../../helpers/auth-state'
import {
  assertNoHorizontalScroll,
  assertNoElementOverlap,
  assertRightOf,
  assertAdjacent,
  assertWithinContainer,
  assertMinWidth,
  assertNotOverlapping,
} from '../../helpers/visual-assertions'

/**
 * WEB-WORKSPACE-LAYOUT-UAT-001 — 真实浏览器布局/按钮位置 UAT。
 * 多视口截图 + boundingBox 几何断言 + 点击行为断言。
 * 禁止仅 toBeVisible；错误布局必须失败；不做截图 baseline 对比（仅存证据图）。
 */

const ARTIFACT_DIR = 'e2e/artifacts/web-workspace-layout'

async function assertRolePickerAdjacent(page: Page) {
  const picker = await page.getByTestId('role-picker').boundingBox()
  const trigger = await page.getByTestId('mention-role-btn').boundingBox()
  expect(picker).toBeTruthy()
  expect(trigger).toBeTruthy()
  const edge = picker!.y < trigger!.y ? 'above' : 'below'
  await assertAdjacent(page, '[data-testid="role-picker"]', '[data-testid="mention-role-btn"]', edge, 16)
}

async function seedWorkspace(page: Page) {
  const ts = Date.now()
  const res = await page.request.post('/api/workspaces', {
    data: { name: `E2E-LAYOUT-${ts}`, execution_domain: 'cloud' },
  })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).id as string
}

test.describe('Web workspace 桌面三栏布局几何', () => {
  let storageState: string
  test.beforeAll(async () => {
    storageState = await ensureAcceptanceStorageState()
  })

  for (const vp of [
    { w: 1440, h: 900 },
    { w: 1280, h: 800 },
  ]) {
    test(`${vp.w}x${vp.h}：三栏稳定 + 6类按钮位置 + 点击行为`, async ({ browser }) => {
      const context = await browser.newContext({ storageState, viewport: { width: vp.w, height: vp.h } })
      const page = await context.newPage()

      const wsId = await seedWorkspace(page)
      await page.goto(`/workspace/${wsId}`)
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByTestId('workspace-shell')).toBeVisible()

      // 三栏：默认右栏开 → 三栏不重叠 + 无横滚 + 中栏最小可用宽度
      await expect(page.getByTestId('chat-panel')).toBeVisible()
      await expect(page.getByTestId('artifact-overlay')).toBeVisible()
      await assertNoHorizontalScroll(page)
      await assertNoElementOverlap(page, '[data-testid="workspace-shell"] > *')
      await assertMinWidth(page, '[data-testid="chat-panel"]', 480)

      // 2. 新建会话按钮在“会话”区标题右侧
      await assertRightOf(page, '[data-testid="new-session-btn"]', '[data-testid="session-header-title"]')

      // 3. workspace 切换入口在左栏顶部 → 展开列表不超出左栏/不错位
      await page.getByTestId('workspace-switcher').click()
      await expect(page.getByTestId('workspace-dropdown')).toBeVisible()
      await assertWithinContainer(page, '[data-testid="workspace-dropdown"]', '[data-testid="sidebar-region"]')
      await page.getByTestId('workspace-switcher').click()

      // 2(行为). 新建会话 → 真实创建 + 选中 + 输入可用
      await page.getByTestId('new-session-btn').click()
      const firstSession = page.getByTestId('session-list').locator('button').first()
      await expect(firstSession).toBeVisible({ timeout: 10000 })
      await expect(firstSession).toHaveClass(/bg-primary\/10/)
      await expect(page.getByTestId('composer-input')).toBeEnabled()

      // 4. @角色按钮在 composer 工具栏 + picker 贴近按钮且不遮挡输入/发送
      await assertWithinContainer(page, '[data-testid="mention-role-btn"]', '[data-testid="composer-toolbar"]')
      await page.getByTestId('mention-role-btn').click()
      const picker = page.getByTestId('role-picker')
      await expect(picker).toBeVisible()
      await assertRolePickerAdjacent(page)
      await assertNotOverlapping(page, '[data-testid="role-picker"]', '[data-testid="composer-input"]')
      await assertNotOverlapping(page, '[data-testid="role-picker"]', '[data-testid="send-btn"]')
      await page.getByTestId('mention-role-btn').click()

      // 5. 发送按钮在输入框右侧 + 三态位置稳定
      await assertRightOf(page, '[data-testid="send-btn"]', '[data-testid="composer-input"]')
      const sendBox0 = await page.getByTestId('send-btn').boundingBox()
      await page.getByTestId('composer-input').fill(`LAYOUT-${vp.w}-${Date.now()}`)
      await assertRightOf(page, '[data-testid="send-btn"]', '[data-testid="composer-input"]')
      const [chatRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/chat') && r.request().method() === 'POST'),
        page.getByTestId('send-btn').click(),
      ])
      expect(chatRes.ok()).toBeTruthy()
      await expect(page.getByTestId('composer-input')).toHaveValue('')
      const sendBox1 = await page.getByTestId('send-btn').boundingBox()
      expect(Math.abs(sendBox1!.x - sendBox0!.x), '发送按钮 x 三态稳定').toBeLessThanOrEqual(2)

      // 6. Agent/Artifact 面板入口在 header 右侧 + 关闭按钮在右栏右侧 + 开合不压中栏
      await assertRightOf(page, '[data-testid="toggle-artifact-btn"]', '[data-testid="chat-panel"] h2')
      await page.getByTestId('artifact-close-btn').click()
      await expect(page.getByTestId('artifact-overlay')).toHaveCount(0)
      await assertMinWidth(page, '[data-testid="chat-panel"]', 480)
      await page.getByTestId('toggle-artifact-btn').click()
      await expect(page.getByTestId('artifact-overlay')).toBeVisible()

      await page.screenshot({ path: `${ARTIFACT_DIR}/desktop-${vp.w}x${vp.h}.png`, fullPage: false })
      await context.close()
    })
  }
})

test.describe('Web workspace 窄屏（移动宽度）布局', () => {
  test.use({ viewport: { width: 768, height: 1024 } })
  let storageState: string
  test.beforeAll(async () => {
    storageState = await ensureAcceptanceStorageState()
  })

  test('768 窄屏：单列聊天为主 + 右栏 overlay 不挤压 + 左栏入口可开', async ({ browser }) => {
    const context = await browser.newContext({ storageState, viewport: { width: 768, height: 1024 } })
    const page = await context.newPage()

    const wsId = await seedWorkspace(page)
    await page.goto(`/workspace/${wsId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByTestId('workspace-shell')).toBeVisible()

    // 无横向溢出（核心移动失稳缺口）
    await assertNoHorizontalScroll(page)

    // 移动：左栏入口可见 → 点击打开抽屉 → 不遮挡后可关闭
    await expect(page.getByTestId('open-sidebar')).toBeVisible()
    await page.getByTestId('open-sidebar').click()
    await expect(page.getByTestId('sidebar-region')).toBeVisible()
    await assertWithinContainer(page, '[data-testid="new-session-btn"]', '[data-testid="sidebar-region"]')
    await page.getByTestId('sidebar-backdrop').click()

    // 右栏 overlay 模式：开启不把中栏聊天区压到不可用（仍 >=480 或 overlay 覆盖在上层）
    await page.getByTestId('toggle-artifact-btn').click()
    await expect(page.getByTestId('artifact-overlay')).toBeVisible()
    await assertMinWidth(page, '[data-testid="chat-panel"]', 480)

    await page.screenshot({ path: `${ARTIFACT_DIR}/narrow-768.png`, fullPage: false })
    await context.close()
  })
})
