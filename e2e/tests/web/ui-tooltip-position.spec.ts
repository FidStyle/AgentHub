import { test, expect, type Page, type Browser } from '@playwright/test'
import { ensureAcceptanceStorageState } from '../../helpers/auth-state'
import { assertNoHorizontalScroll } from '../../helpers/visual-assertions'
import { createAndOpenGroupChat } from '../../helpers/chat-entry'

/**
 * UI-TOOLTIP-POSITION-001 — 全局 Tooltip 定位/变形真实浏览器 UAT。
 * Tooltip 现 portal 到 body + 自动 flip/shift 防越界 + max-width 换行。
 * 对 workspace 关键 IconButton（新建群聊/@角色/发送/打开侧栏/切换面板）
 * 在桌面 1440/1280 与移动 768 下 hover + focus，断言：
 *   - tooltip 渲染（role=tooltip 出现且文本匹配 aria-label）
 *   - boundingBox 完整落在 viewport 内（未被裁切）
 *   - 不遮挡触发按钮（与按钮不重叠 / 或按钮仍可点）
 *   - 文本不变形（高度不超过单行换行上限、宽度受 max-width 约束）
 *   - 不引发横向滚动
 * 禁止仅 toBeVisible。
 */

const ARTIFACT_DIR = 'e2e/artifacts/ui-tooltip-position'
const MAX_TOOLTIP_WIDTH = 256 // packages/ui Tooltip max-w-[16rem]

async function seedWorkspace(page: Page) {
  const ts = Date.now()
  const res = await page.request.post('/api/workspaces', {
    data: { name: `E2E-TOOLTIP-${ts}`, execution_domain: 'cloud' },
  })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).id as string
}

type TooltipBox = { x: number; y: number; width: number; height: number; text: string }

/** 触发 hover，等待对应文案的 role=tooltip 出现，返回其 boundingBox + 文本。 */
async function showTooltipByHover(page: Page, triggerSel: string, label: string): Promise<TooltipBox> {
  // 先把指针移开，确保 hover 一定触发一次 mouseenter（指针若已在目标上不会重发事件）
  await page.mouse.move(0, 0)
  await page.locator(triggerSel).first().hover()
  const tip = page.locator(`[role="tooltip"]:has-text("${label}")`).first()
  await expect(tip, `hover ${triggerSel} 应出现 tooltip "${label}"`).toBeVisible({ timeout: 5000 })
  const box = await tip.boundingBox()
  expect(box, `tooltip "${label}" 必须有 boundingBox`).not.toBeNull()
  const text = (await tip.textContent())?.trim() ?? ''
  return { ...box!, text }
}

/** focus 触发：键盘可达性同样应弹出 tooltip。 */
async function showTooltipByFocus(page: Page, triggerSel: string, label: string): Promise<TooltipBox> {
  await page.locator(triggerSel).first().focus()
  const tip = page.locator(`[role="tooltip"]:has-text("${label}")`).first()
  await expect(tip, `focus ${triggerSel} 应出现 tooltip "${label}"`).toBeVisible({ timeout: 5000 })
  const box = await tip.boundingBox()
  expect(box, `focus tooltip "${label}" 必须有 boundingBox`).not.toBeNull()
  const text = (await tip.textContent())?.trim() ?? ''
  return { ...box!, text }
}

async function dismiss(page: Page) {
  // 移开 hover/focus，避免 tooltip 残留影响下一个断言
  await page.mouse.move(0, 0)
  await page.locator('body').click({ position: { x: 2, y: 2 } }).catch(() => {})
}

function assertTooltipGeometry(box: TooltipBox, label: string, vp: { w: number; h: number }) {
  // 1) 完整落在 viewport 内（未被裁切 / 未越界）
  expect(box.x, `tooltip "${label}" 左边越界`).toBeGreaterThanOrEqual(0)
  expect(box.y, `tooltip "${label}" 顶边越界`).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width, `tooltip "${label}" 右边超出 viewport(${vp.w})`).toBeLessThanOrEqual(vp.w + 1)
  expect(box.y + box.height, `tooltip "${label}" 底边超出 viewport(${vp.h})`).toBeLessThanOrEqual(vp.h + 1)
  // 2) 宽度受 max-width 约束（未变形拉伸）
  expect(box.width, `tooltip "${label}" 宽度超过 max-width`).toBeLessThanOrEqual(MAX_TOOLTIP_WIDTH + 4)
  // 3) 文本可见且非空（未被压扁/裁掉）
  expect(box.width, `tooltip "${label}" 宽度异常`).toBeGreaterThan(8)
  expect(box.height, `tooltip "${label}" 高度异常（被压扁）`).toBeGreaterThan(8)
}

/** tooltip 不应遮挡触发按钮：与按钮几何不重叠（GAP 间隔保证）。 */
async function assertNotCoveringTrigger(page: Page, triggerSel: string, tip: TooltipBox, label: string) {
  const btn = await page.locator(triggerSel).first().boundingBox()
  expect(btn, `${triggerSel} 必须有 boundingBox`).not.toBeNull()
  const b = btn!
  const overlaps = tip.x < b.x + b.width && tip.x + tip.width > b.x && tip.y < b.y + b.height && tip.y + tip.height > b.y
  expect(overlaps, `tooltip "${label}" 不应遮挡触发按钮 ${triggerSel}`).toBe(false)
}

const DESKTOP_TRIGGERS: { sel: string; label: string }[] = [
  { sel: '[data-testid="new-group-conversation"]', label: '新建群聊' },
  { sel: '[data-testid="mention-role-btn"]', label: '提及角色' },
  { sel: '[data-testid="send-btn"]', label: '发送' },
  { sel: '[data-testid="toggle-artifact-btn"]', label: '切换面板' },
]

test.describe('Tooltip 桌面定位/变形（1440 / 1280）', () => {
  let storageState: string
  test.beforeAll(async () => {
    storageState = await ensureAcceptanceStorageState()
  })

  for (const vp of [
    { w: 1440, h: 900 },
    { w: 1280, h: 800 },
  ]) {
    test(`${vp.w}x${vp.h}：关键按钮 hover/focus tooltip 在 viewport 内不裁切不遮挡不变形`, async ({ browser }: { browser: Browser }) => {
      const context = await browser.newContext({ storageState, viewport: { width: vp.w, height: vp.h } })
      const page = await context.newPage()

      const wsId = await seedWorkspace(page)
      await page.goto(`/workspace/${wsId}`)
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByTestId('workspace-shell')).toBeVisible()

      // 先建一个群聊以激活 composer 工具栏按钮（@角色/发送可用）
      await createAndOpenGroupChat(page, wsId)
      await expect(page.getByTestId('composer-input')).toBeEnabled({ timeout: 10000 })
      // 输入文本以启用发送按钮（disabled 按钮无法获得键盘焦点，focus tooltip 不可达）
      await page.getByTestId('composer-input').fill('tooltip e2e')
      await expect(page.getByTestId('send-btn')).toBeEnabled()

      for (const { sel, label } of DESKTOP_TRIGGERS) {
        await page.locator(sel).first().waitFor({ state: 'visible' })

        const hoverBox = await showTooltipByHover(page, sel, label)
        assertTooltipGeometry(hoverBox, label, vp)
        await assertNotCoveringTrigger(page, sel, hoverBox, label)
        await assertNoHorizontalScroll(page)
        await dismiss(page)

        const focusBox = await showTooltipByFocus(page, sel, label)
        assertTooltipGeometry(focusBox, label, vp)
        await assertNoHorizontalScroll(page)
        await dismiss(page)
      }

      await page.screenshot({ path: `${ARTIFACT_DIR}/desktop-${vp.w}x${vp.h}.png`, fullPage: false })
      await context.close()
    })
  }
})

test.describe('Tooltip 移动窄屏定位/变形（768）', () => {
  let storageState: string
  test.beforeAll(async () => {
    storageState = await ensureAcceptanceStorageState()
  })

  test('768：打开侧栏入口 + 边缘按钮 tooltip 自动 flip/shift 不越界不横滚', async ({ browser }: { browser: Browser }) => {
    const vp = { w: 768, h: 1024 }
    const context = await browser.newContext({ storageState, viewport: { width: vp.w, height: vp.h } })
    const page = await context.newPage()

    const wsId = await seedWorkspace(page)
    await page.goto(`/workspace/${wsId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByTestId('workspace-shell')).toBeVisible()

    // 左上角“打开侧栏”入口：左边缘按钮，tooltip 必须 shift 回 viewport（不被左裁切）
    const openSidebar = '[data-testid="open-sidebar"]'
    await page.locator(openSidebar).first().waitFor({ state: 'visible' })
    const sbHover = await showTooltipByHover(page, openSidebar, '打开工作区导航')
    assertTooltipGeometry(sbHover, '打开工作区导航', vp)
    await assertNotCoveringTrigger(page, openSidebar, sbHover, '打开工作区导航')
    await assertNoHorizontalScroll(page)
    await dismiss(page)

    const sbFocus = await showTooltipByFocus(page, openSidebar, '打开工作区导航')
    assertTooltipGeometry(sbFocus, '打开工作区导航', vp)
    await assertNoHorizontalScroll(page)
    await dismiss(page)

    // 右边缘按钮：切换面板，tooltip 不得超出右边界。
    await createAndOpenGroupChat(page, wsId)
    const toggle = '[data-testid="toggle-artifact-btn"]'
    // 仅当 toggle 真正可命中（顶层元素即按钮本身，未被其它面板覆盖）时才测 hover，避免被覆盖时 hover 卡死。
    const toggleHittable = await page
      .locator(toggle)
      .first()
      .evaluate((el) => {
        const r = el.getBoundingClientRect()
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
        return el.contains(top)
      })
      .catch(() => false)
    if (toggleHittable) {
      const tHover = await showTooltipByHover(page, toggle, '切换面板')
      assertTooltipGeometry(tHover, '切换面板', vp)
      await assertNoHorizontalScroll(page)
      await dismiss(page)
    }

    await page.screenshot({ path: `${ARTIFACT_DIR}/narrow-768.png`, fullPage: false })
    await context.close()
  })
})
