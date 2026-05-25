import { type Page, expect } from '@playwright/test'

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
