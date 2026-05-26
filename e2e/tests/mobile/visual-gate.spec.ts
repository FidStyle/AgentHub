import { test, expect } from '../fixtures'
import {
  assertNoHorizontalScroll,
  assertNoTextOverflow,
  assertNoSensitiveFields,
  assertUsesUnifiedVisualSystem,
  captureCrossSurfaceComparison,
} from '../../helpers/visual-assertions'
import path from 'path'
import fs from 'fs'

const artifactDir = path.resolve(__dirname, '../../artifacts/mobile')

test.describe('Mobile/PWA 视觉门禁', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeAll(() => {
    fs.mkdirSync(artifactDir, { recursive: true })
  })

  test('工作区列表无横向滚动', async ({ authedPage: page }) => {
    await page.goto('/m')
    await page.waitForSelector('[data-testid="mobile-session"]')
    await assertNoHorizontalScroll(page)
  })

  test('工作区列表标题不溢出', async ({ authedPage: page }) => {
    await page.goto('/m')
    await page.waitForSelector('[data-testid="mobile-session"]')
    await assertNoTextOverflow(page, 'button span, p')
  })

  test('审批页无横向滚动', async ({ authedPage: page }) => {
    await page.goto('/m/approve')
    await page.waitForSelector('[data-testid="mobile-session"]')
    await assertNoHorizontalScroll(page)
  })

  test('无敏感字段', async ({ authedPage: page }) => {
    await page.goto('/m')
    await assertNoSensitiveFields(page)
  })

  test('截图留存 - 工作区列表', async ({ authedPage: page }) => {
    await page.goto('/m')
    await page.waitForSelector('[data-testid="mobile-session"]')
    await page.screenshot({ path: path.join(artifactDir, 'workspace-list-390x844.png'), fullPage: true })
  })

  test('截图留存 - 审批页', async ({ authedPage: page }) => {
    await page.goto('/m/approve')
    await page.waitForSelector('[data-testid="mobile-session"]')
    await page.screenshot({ path: path.join(artifactDir, 'approve-390x844.png'), fullPage: true })
  })

  test('统一视觉母版断言', async ({ authedPage: page }) => {
    await page.goto('/m')
    await page.waitForSelector('[data-testid="mobile-session"]')
    await assertUsesUnifiedVisualSystem(page)
  })

  test('三端对照截图 - Mobile 工作区', async ({ authedPage: page }) => {
    await page.goto('/m')
    await page.waitForSelector('[data-testid="mobile-session"]')
    await captureCrossSurfaceComparison(page, 'mobile', 'workspace')
  })
})
