import { test, expect } from '../fixtures'
import {
  assertNoHorizontalScroll,
  assertNoElementOverlap,
  assertNoTextOverflow,
  assertNoSensitiveFields,
  assertUsesUnifiedVisualSystem,
  captureCrossSurfaceComparison,
} from '../../helpers/visual-assertions'
import path from 'path'
import fs from 'fs'

const artifactDir = path.resolve(__dirname, '../../artifacts/web')

test.describe('Web 工作台视觉门禁', () => {
  test.beforeAll(() => {
    fs.mkdirSync(artifactDir, { recursive: true })
  })

  test.describe('1440x900 桌面视口', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('三栏布局无横向滚动', async ({ authedPage: page }) => {
      await page.goto('/workspace/test-session')
      await page.waitForSelector('[data-testid="workspace-shell"]')
      await assertNoHorizontalScroll(page)
    })

    test('三栏不重叠', async ({ authedPage: page }) => {
      await page.goto('/workspace/test-session')
      await page.waitForSelector('[data-testid="workspace-shell"]')
      await assertNoElementOverlap(page, '[data-testid="workspace-shell"] > *')
    })

    test('无敏感字段', async ({ authedPage: page }) => {
      await page.goto('/workspace/test-session')
      await page.waitForSelector('[data-testid="workspace-shell"]')
      await assertNoSensitiveFields(page)
    })

    test('截图留存 - 工作台全貌', async ({ authedPage: page }) => {
      await page.goto('/workspace/test-session')
      await page.waitForSelector('[data-testid="workspace-shell"]')
      await page.screenshot({ path: path.join(artifactDir, 'workspace-1440x900.png'), fullPage: true })
    })

    test('统一视觉母版断言', async ({ authedPage: page }) => {
      await page.goto('/workspace/test-session')
      await page.waitForSelector('[data-testid="workspace-shell"]')
      await assertUsesUnifiedVisualSystem(page)
    })

    test('三端对照截图 - Web 工作台', async ({ authedPage: page }) => {
      await page.goto('/workspace/test-session')
      await page.waitForSelector('[data-testid="workspace-shell"]')
      await captureCrossSurfaceComparison(page, 'web', 'workspace')
    })
  })

  test.describe('1024x768 平板视口', () => {
    test.use({ viewport: { width: 1024, height: 768 } })

    test('无横向滚动', async ({ authedPage: page }) => {
      await page.goto('/workspace/test-session')
      await page.waitForSelector('[data-testid="workspace-shell"]')
      await assertNoHorizontalScroll(page)
    })

    test('截图留存 - 平板视口', async ({ authedPage: page }) => {
      await page.goto('/workspace/test-session')
      await page.waitForSelector('[data-testid="workspace-shell"]')
      await page.screenshot({ path: path.join(artifactDir, 'workspace-1024x768.png'), fullPage: true })
    })
  })

  test.describe('中文文案扫描', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('button/label 无纯英文文案（技术术语除外）', async ({ authedPage: page }) => {
      await page.goto('/workspace/test-session')
      await page.waitForSelector('[data-testid="workspace-shell"]')

      const allowedEnglish = /^(Runtime|Agents?|Claude|AgentHub|OK|Cancel|WebSocket|API|PWA|URL|ID|UI)$/i
      const issues = await page.evaluate((allowedPattern) => {
        const re = new RegExp(allowedPattern, 'i')
        const problems: string[] = []
        document.querySelectorAll('button, label, [placeholder]').forEach(el => {
          const text = (el as HTMLElement).innerText?.trim() || (el as HTMLInputElement).placeholder?.trim()
          if (!text) return
          // Pure ASCII text that isn't an allowed term
          if (/^[a-zA-Z0-9\s\-_.]+$/.test(text) && !re.test(text)) {
            problems.push(`"${text}" in <${el.tagName.toLowerCase()}>`)
          }
        })
        return problems
      }, allowedEnglish.source)

      expect(issues, `Found English-only text: ${issues.join(', ')}`).toHaveLength(0)
    })
  })
})
