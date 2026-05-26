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
