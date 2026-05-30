import { type Page, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

export async function assertNoHorizontalScroll(page: Page) {
  const hasScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(hasScroll).toBe(false)
}

export async function assertNoElementOverlap(page: Page, selector: string) {
  const rects = await page.$$eval(selector, els =>
    els.map(el => {
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
    })
  )
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j]
      const overlaps = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
      expect(overlaps, `Elements ${i} and ${j} overlap`).toBe(false)
    }
  }
}

export async function assertNoTextOverflow(page: Page, selector: string) {
  const overflows = await page.$$eval(selector, els =>
    els.filter(el => el.scrollWidth > el.clientWidth + 1).length
  )
  expect(overflows).toBe(0)
}

export async function assertNoSensitiveFields(page: Page) {
  const sensitiveInputs = await page.locator('input[type="password"], input[name*="api_key"], input[name*="apiKey"], input[name*="secret"], input[placeholder*="API Key"], input[placeholder*="Base URL"], input[placeholder*="sk-"]').count()
  expect(sensitiveInputs, 'Page must not contain sensitive input fields').toBe(0)

  const sensitiveLabels = await page.locator('label:text-matches("API Key|API Secret|Base URL|密钥", "i")').count()
  expect(sensitiveLabels, 'Page must not contain sensitive labels').toBe(0)
}

/**
 * 断言页面使用了统一视觉母版（shadcn/ui token 体系）。
 * 检查核心 UI 区域存在共享设计 token class，而非临时内联样式。
 */
export async function assertUsesUnifiedVisualSystem(page: Page) {
  const result = await page.evaluate(() => {
    const tokenPatterns = [
      'bg-card', 'bg-background', 'bg-muted', 'bg-primary',
      'text-primary', 'text-muted-foreground', 'text-foreground',
      'border-border', 'rounded-md', 'rounded-lg',
    ]
    const allElements = document.querySelectorAll('[class]')
    const tokenHits = new Set<string>()
    allElements.forEach(el => {
      const cls = el.getAttribute('class') || ''
      for (const t of tokenPatterns) {
        if (cls.includes(t)) tokenHits.add(t)
      }
    })

    const hasInlineStyleAbuse = (() => {
      let inlineCount = 0
      document.querySelectorAll('[style]').forEach(el => {
        const s = (el as HTMLElement).style
        if (s.backgroundColor || s.color || s.borderRadius || s.border) inlineCount++
      })
      return inlineCount > 5
    })()

    return { tokenCount: tokenHits.size, tokens: [...tokenHits], hasInlineStyleAbuse }
  })

  expect(result.tokenCount, `Page uses only ${result.tokenCount} design tokens (${result.tokens.join(', ')}). Expected ≥4 shared tokens from unified visual system.`).toBeGreaterThanOrEqual(4)
  expect(result.hasInlineStyleAbuse, 'Page has excessive inline styles bypassing the design system').toBe(false)
}

async function boxOf(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox()
  expect(box, `Element ${selector} has no bounding box (not rendered/visible)`).not.toBeNull()
  return box!
}

/** rightSel 必须位于 leftSel 右侧（rightSel.left >= leftSel.right - tolerance）。 */
export async function assertRightOf(page: Page, rightSel: string, leftSel: string, tolerance = 2) {
  const right = await boxOf(page, rightSel)
  const left = await boxOf(page, leftSel)
  expect(right.x, `${rightSel} 应在 ${leftSel} 右侧`).toBeGreaterThanOrEqual(left.x + left.width - tolerance)
}

/** sel 必须紧贴 anchorSel 的指定边（间距 <= maxGap），且水平方向有重叠（对齐）。 */
export async function assertAdjacent(
  page: Page,
  sel: string,
  anchorSel: string,
  edge: 'above' | 'below',
  maxGap = 12,
) {
  const el = await boxOf(page, sel)
  const anchor = await boxOf(page, anchorSel)
  const gap = edge === 'above' ? anchor.y - (el.y + el.height) : el.y - (anchor.y + anchor.height)
  expect(gap, `${sel} 应紧贴 ${anchorSel} ${edge}（gap=${gap}）`).toBeGreaterThanOrEqual(-1)
  expect(gap, `${sel} 与 ${anchorSel} 间距过大（gap=${gap} > ${maxGap}）`).toBeLessThanOrEqual(maxGap)
  const overlapX = Math.min(el.x + el.width, anchor.x + anchor.width) - Math.max(el.x, anchor.x)
  expect(overlapX, `${sel} 应与 ${anchorSel} 水平对齐`).toBeGreaterThan(0)
}

/** childSel 完全落在 containerSel 几何范围内（不超出/不错位）。 */
export async function assertWithinContainer(page: Page, childSel: string, containerSel: string, tolerance = 2) {
  const child = await boxOf(page, childSel)
  const container = await boxOf(page, containerSel)
  expect(child.x, `${childSel} 左边超出 ${containerSel}`).toBeGreaterThanOrEqual(container.x - tolerance)
  expect(child.y, `${childSel} 顶边超出 ${containerSel}`).toBeGreaterThanOrEqual(container.y - tolerance)
  expect(child.x + child.width, `${childSel} 右边超出 ${containerSel}`).toBeLessThanOrEqual(container.x + container.width + tolerance)
  expect(child.y + child.height, `${childSel} 底边超出 ${containerSel}`).toBeLessThanOrEqual(container.y + container.height + tolerance)
}

/** sel 渲染宽度必须 >= minPx（中栏聊天区最小可用宽度守卫）。 */
export async function assertMinWidth(page: Page, selector: string, minPx: number) {
  const box = await boxOf(page, selector)
  expect(box.width, `${selector} 宽度 ${box.width} 小于最小可用宽度 ${minPx}`).toBeGreaterThanOrEqual(minPx)
}

/** a 与 b 几何上不重叠（任一维度分离即可）。 */
export async function assertNotOverlapping(page: Page, aSel: string, bSel: string) {
  const a = await boxOf(page, aSel)
  const b = await boxOf(page, bSel)
  const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  expect(overlaps, `${aSel} 不应遮挡 ${bSel}`).toBe(false)
}

export type Surface = 'web' | 'desktop' | 'mobile'

const CROSS_SURFACE_DIR = path.resolve(__dirname, '../artifacts/cross-surface')

/**
 * 按 surface + state 保存截图，用于三端同状态对照。
 */
export async function captureCrossSurfaceComparison(
  page: Page,
  surface: Surface,
  state: string,
) {
  fs.mkdirSync(path.join(CROSS_SURFACE_DIR, state), { recursive: true })
  const filePath = path.join(CROSS_SURFACE_DIR, state, `${surface}.png`)
  await page.screenshot({ path: filePath, fullPage: true })
  return filePath
}
