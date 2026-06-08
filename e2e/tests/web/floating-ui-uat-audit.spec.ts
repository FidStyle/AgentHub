import { test, expect, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { ensureAcceptanceStorageState } from '../../helpers/auth-state'

/**
 * FLOATING-UI-UAT-AUDIT-001 — 只读浮层/Overlay 真实浏览器几何审计。
 *
 * 对 workspace 活动路由（/workspace/[id] → WorkspaceShell）下的浮层做真实
 * hover/focus/click 打开，采集 trigger bbox + floating bbox，做几何断言：
 *   - 完整落在 viewport 内（未越界 / 未被裁切）
 *   - 不遮挡 trigger（除非语义允许）
 *   - 不引发横向滚动
 *   - 文本不变形（宽度受 max-width 约束、无横向溢出）
 * 审计目标：T1 tooltip / D1 workspace 下拉 / D2 role picker / O1 artifact 抽屉 / O2 sidebar 抽屉。
 *
 * 只读：不修改产品代码。观察结果（含越界/裁切/遮挡判定）写入 findings JSON 供报告引用。
 * 禁止用 toBeVisible 代替几何断言——本 spec 的所有判定均基于 boundingBox 几何。
 *
 * FIX-D1（REG-20260531-002 / GAP-001）已修复后，D1 段升级为回归硬门禁：除记录 finding 外，
 * 追加几何硬断言（floating bbox 在视口内 + bottom 不超视口 + 无横滚），守护 D1 从 high 回到 pass。
 */

type Box = { x: number; y: number; width: number; height: number }
type Finding = {
  id: string
  viewport: string
  target: string
  selector: string
  triggerBox: Box | null
  floatingBox: Box | null
  symptoms: string[]
  severity: 'critical' | 'high' | 'medium' | 'low' | 'ok'
  reference: string
  screenshot: string
  suggestedTask: string
}

const ARTIFACT_DIR = 'e2e/artifacts/floating-ui-uat-audit'
const FINDINGS_PATH = 'research/execution-reports/floating-ui-uat-audit-001-findings.json'
const MAX_ROLE_PICKER_WIDTH = 320 // popover 合理上限：长角色名不应撑爆

const findings: Finding[] = []

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '768x900', width: 768, height: 900 },
]

function record(f: Finding) {
  findings.push(f)
}

function inViewport(box: Box, vw: number, vh: number): string[] {
  const s: string[] = []
  if (box.x < 0) s.push(`左越界 (x=${Math.round(box.x)})`)
  if (box.y < 0) s.push(`上越界 (y=${Math.round(box.y)})`)
  if (box.x + box.width > vw + 1) s.push(`右越界 (right=${Math.round(box.x + box.width)} > vw=${vw})`)
  if (box.y + box.height > vh + 1) s.push(`下越界 (bottom=${Math.round(box.y + box.height)} > vh=${vh})`)
  return s
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

async function boxOf(page: Page, sel: string): Promise<Box | null> {
  return page.locator(sel).first().boundingBox()
}

async function seedWorkspace(page: Page): Promise<string> {
  const ts = Date.now()
  const res = await page.request.post('/api/workspaces', {
    data: { name: `E2E-FLOAT-${ts}`, execution_domain: 'cloud' },
  })
  expect(res.ok(), 'workspace 播种应成功（真实 DB/auth）').toBeTruthy()
  const wsId = (await res.json()).id as string
  // 播种一个群聊，使 composer / role picker 可用（@角色按钮非 disabled）
  await page.request.post('/api/sessions', { data: { workspace_id: wsId, name: `S-${ts}` } }).catch(() => {})
  // 播种一个长名角色，用于检验 role picker 的 max-width / 换行（R5）
  await page.request
    .post('/api/role-agents', {
      data: {
        workspace_id: wsId,
        name: '资深全栈架构师与运行时编排负责人（超长名称用于换行审计）',
        role_type: 'architect',
        system_prompt: 'audit',
      },
    })
    .catch(() => {})
  return wsId
}

async function shot(page: Page, name: string): Promise<string> {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
  const p = path.join(ARTIFACT_DIR, `${name}.png`)
  await page.screenshot({ path: p })
  return p
}

// 每个视口 test 独立 worker，afterAll 仅见本 worker 数据 → 合并写盘（按 viewport 去重）。
function persistFindings() {
  fs.mkdirSync(path.dirname(FINDINGS_PATH), { recursive: true })
  let existing: Finding[] = []
  try {
    const prev = JSON.parse(fs.readFileSync(FINDINGS_PATH, 'utf8'))
    if (Array.isArray(prev.findings)) existing = prev.findings
  } catch {
    /* first writer */
  }
  const thisViewports = new Set(findings.map((f) => f.viewport))
  const merged = existing.filter((f) => !thisViewports.has(f.viewport)).concat(findings)
  const order = (v: string) => VIEWPORTS.findIndex((x) => x.name === v)
  merged.sort((a, b) => order(a.viewport) - order(b.viewport) || a.id.localeCompare(b.id))
  const summary = {
    task: 'FLOATING-UI-UAT-AUDIT-001',
    generatedAt: new Date().toISOString(),
    method: 'real browser (Chromium) + real DB (agenthub_acceptance) + real Auth.js session',
    viewports: VIEWPORTS.map((v) => v.name),
    geometricAssertionsOnly: true,
    findings: merged,
  }
  fs.writeFileSync(FINDINGS_PATH, JSON.stringify(summary, null, 2))
}

test.afterAll(async () => {
  persistFindings()
})

for (const vp of VIEWPORTS) {
  test.describe(`floating-ui audit @ ${vp.name}`, () => {
    let storageState: string
    test.beforeAll(async () => {
      storageState = await ensureAcceptanceStorageState()
    })

    test(`浮层几何审计 ${vp.name}`, async ({ browser }) => {
      const context = await browser.newContext({ storageState, viewport: { width: vp.width, height: vp.height } })
      const page = await context.newPage()
      const wsId = await seedWorkspace(page)
      await page.goto(`/workspace/${wsId}`)
      await page.waitForLoadState('networkidle')

      const isMobile = vp.width < 1024

      // ---- O1（移动）：artifact 抽屉默认开启（rightPanelOpen=true），先审计 backdrop+z 分层+点击关闭，
      // 再夹起模态抽屉，使后续 T1/D1/D2 在无模态遮罩下交互（modal drawer 必须先 dismiss 才能操作其下层）。
      if (isMobile) {
        const o1Sel = '[data-testid="artifact-overlay"]'
        const backdropSel = '[data-testid="artifact-backdrop"]'
        const o1Box = await boxOf(page, o1Sel)
        const backdropBox = await boxOf(page, backdropSel)
        const o1Symptoms: string[] = []
        if (o1Box) o1Symptoms.push(...inViewport(o1Box, vp.width, vp.height))
        if (!backdropBox) o1Symptoms.push('移动态无 backdrop / 无点击外部关闭（对照 sidebar 抽屉有 backdrop）')
        else if (backdropBox.width < vp.width - 1 || backdropBox.height < vp.height - 1) o1Symptoms.push('backdrop 未覆盖全视口')
        const zLayers = await page.evaluate(([bSel, oSel]) => {
          const z = (s: string) => {
            const el = document.querySelector(s)
            return el ? parseInt(getComputedStyle(el).zIndex || '0', 10) || 0 : null
          }
          return { backdrop: z(bSel), overlay: z(oSel) }
        }, [backdropSel, o1Sel])
        if (zLayers.backdrop !== null && zLayers.overlay !== null && zLayers.backdrop >= zLayers.overlay)
          o1Symptoms.push(`backdrop z(${zLayers.backdrop}) 未低于抽屉 z(${zLayers.overlay})`)
        const o1Shot = await shot(page, `${vp.name}-O1-artifact-overlay`)
        record({
          id: 'O1', viewport: vp.name, target: 'artifact panel overlay（移动抽屉）', selector: o1Sel,
          triggerBox: null, floatingBox: o1Box, symptoms: o1Symptoms,
          severity: o1Symptoms.some((s) => s.includes('越界')) ? 'high' : o1Symptoms.length ? 'medium' : 'ok',
          reference: 'R9（fixed inset + backdrop + 外部关闭 + z 分层）', screenshot: o1Shot,
          suggestedTask: o1Symptoms.length === 0 ? '无（FIX-O1 已修复，回归确认）' : 'FIX-O1: artifact 移动抽屉补 backdrop + 点击外部关闭 + 与 sidebar 抽屉 z 分层',
        })
        // FIX-O1 回归硬门禁（REG-20260531-003）：移动态必须有覆盖全视口 backdrop、z 低于抽屉、点击 backdrop 关闭抽屉。
        expect(backdropBox, `${vp.name} O1 移动态应有 artifact-backdrop`).not.toBeNull()
        expect(o1Symptoms, `${vp.name} O1 应无 backdrop/越界/z 分层症状（实测: ${o1Symptoms.join('; ') || '无'}）`).toEqual([])
        // 点击 backdrop（视口左侧，避开右侧 320px 抽屉）应关闭抽屉
        await page.mouse.click(Math.round(vp.width * 0.3), Math.round(vp.height / 2))
        await expect(page.locator(o1Sel), `${vp.name} O1 点击 backdrop 后抽屉应关闭`).toHaveCount(0)
      }

      // ---- T1: tooltip（新建群聊按钮）hover + focus ----
      // 移动态左栏在抽屉里，先开抽屉；桌面态左栏常驻。
      if (isMobile) {
        await page.locator('[data-testid="open-sidebar"]').click()
        await expect(page.locator('[data-testid="sidebar-region"]')).toBeVisible()
      }
      {
        const triggerSel = '[data-testid="new-group-conversation"]'
        await page.mouse.move(0, 0)
        await page.locator(triggerSel).first().hover()
        const tip = page.locator('[role="tooltip"]:has-text("新建群聊")').first()
        const visible = await tip.isVisible().catch(() => false)
        const triggerBox = await boxOf(page, triggerSel)
        const floatingBox = visible ? await tip.boundingBox() : null
        const symptoms: string[] = []
        if (!visible) symptoms.push('tooltip 未渲染')
        if (floatingBox) {
          symptoms.push(...inViewport(floatingBox, vp.width, vp.height))
          if (floatingBox.width > 256 + 2) symptoms.push(`宽度超 max-w-16rem (${Math.round(floatingBox.width)})`)
        }
        const sshot = await shot(page, `${vp.name}-T1-tooltip-new-group`)
        record({
          id: 'T1', viewport: vp.name, target: 'tooltip 新建群聊', selector: triggerSel,
          triggerBox, floatingBox, symptoms,
          severity: symptoms.length === 0 ? 'ok' : 'medium',
          reference: 'R1/R2/R3/R5（已修母版对照）', screenshot: sshot,
          suggestedTask: symptoms.length === 0 ? '无（回归确认）' : 'tooltip 回归修复',
        })
        await page.mouse.move(0, 0)
        if (isMobile) await page.locator('[data-testid="sidebar-backdrop"]').click().catch(() => {})
      }

      // ---- D1: workspace selector 下拉 click 打开 ----
      if (isMobile) await page.locator('[data-testid="open-sidebar"]').click()
      {
        const triggerSel = '[data-testid="workspace-switcher"]'
        const dropSel = '[data-testid="workspace-dropdown"]'
        await page.locator(triggerSel).click()
        const visible = await page.locator(dropSel).isVisible().catch(() => false)
        const triggerBox = await boxOf(page, triggerSel)
        const floatingBox = visible ? await boxOf(page, dropSel) : null
        const symptoms: string[] = []
        if (!visible) symptoms.push('下拉未渲染')
        let severity: Finding['severity'] = 'ok'
        if (floatingBox && triggerBox) {
          const oob = inViewport(floatingBox, vp.width, vp.height)
          symptoms.push(...oob)
          // 是否被祖先 overflow 裁切：floating 实际可见高度 < 内容高度
          const clipped = await page.locator(dropSel).evaluate((el) => {
            const r = el.getBoundingClientRect()
            return r.bottom > window.innerHeight + 1
          })
          if (clipped) symptoms.push('下拉底部超出视口且无内部滚动')
          if (oob.length > 0 || clipped) severity = 'high'
        }
        const hScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
        if (hScroll) symptoms.push('引发横向滚动')
        const sshot = await shot(page, `${vp.name}-D1-workspace-dropdown`)
        record({
          id: 'D1', viewport: vp.name, target: 'workspace selector 下拉', selector: dropSel,
          triggerBox, floatingBox, symptoms,
          severity: symptoms.length === 0 ? 'ok' : severity,
          reference: 'R1(portal)/R2(flip)/R4(max-h+内部滚动)/R8(z-50)', screenshot: sshot,
          suggestedTask: symptoms.length === 0 ? '无（FIX-D1 已修复，回归确认）' : 'FIX-D1: workspace 下拉 portal-to-body + flip/shift + max-height 滚动 + z-index 提升',
        })
        // FIX-D1 回归硬门禁（REG-20260531-002 / GAP-001）：修复后下拉必须 portal+flip+max-height，
        // floating bbox 完整落在视口内、bottom 不超视口（max-height 内部滚动而非撑高）、不引发横滚。
        // 几何断言，禁止 toBeVisible 充数；任一症状即 fail，守护 D1 从 high 回到 pass。
        expect(visible, `${vp.name} D1 workspace 下拉应渲染`).toBeTruthy()
        expect(floatingBox, `${vp.name} D1 floatingBox 应可测`).not.toBeNull()
        expect(symptoms, `${vp.name} D1 应无越界/裁切/横滚症状（实测: ${symptoms.join('; ') || '无'}）`).toEqual([])
        if (floatingBox) {
          expect(floatingBox.y + floatingBox.height, `${vp.name} D1 下拉底部不得超出视口`).toBeLessThanOrEqual(vp.height + 1)
        }
        await page.locator(triggerSel).click().catch(() => {})
        // 移动态：关闭下拉后再关抽屉，避免 drawer 覆盖主区 composer 拦截后续点击
        if (isMobile) await page.locator('[data-testid="sidebar-backdrop"]').click().catch(() => {})
      }

      // ---- D2: role picker（@角色）click 打开 ----
      {
        const triggerSel = '[data-testid="mention-role-btn"]'
        const pickerSel = '[data-testid="role-picker"]'
        const enabled = await page.locator(triggerSel).isEnabled().catch(() => false)
        if (enabled) {
          await page.locator(triggerSel).click()
          const visible = await page.locator(pickerSel).isVisible().catch(() => false)
          const triggerBox = await boxOf(page, triggerSel)
          const floatingBox = visible ? await boxOf(page, pickerSel) : null
          const symptoms: string[] = []
          if (!visible) symptoms.push('role picker 未渲染（可能无 active session）')
          let severity: Finding['severity'] = 'ok'
          if (floatingBox) {
            const oob = inViewport(floatingBox, vp.width, vp.height)
            symptoms.push(...oob)
            if (floatingBox.width > MAX_ROLE_PICKER_WIDTH) symptoms.push(`宽度过大 (${Math.round(floatingBox.width)})`)
            if (triggerBox && overlaps(floatingBox, triggerBox)) symptoms.push('遮挡 @角色 触发按钮')
            if (oob.length > 0) severity = 'high'
          }
          const sshot = await shot(page, `${vp.name}-D2-role-picker`)
          record({
            id: 'D2', viewport: vp.name, target: 'role picker @角色', selector: pickerSel,
            triggerBox, floatingBox, symptoms,
            severity: symptoms.length === 0 ? 'ok' : severity,
            reference: 'R1(portal)/R2(flip)/R5(max-w+break-words)/R8(z-50)', screenshot: sshot,
            suggestedTask: symptoms.length === 0 ? '无（FIX-D2 已修复，回归确认）' : 'FIX-D2: role picker portal-to-body + flip/shift + max-width 换行 + z-index 提升',
          })
          // FIX-D2 回归硬门禁：升级后 role picker 必须 portal+flip+clamp，floating bbox 完整落在视口内、
          // 宽度受 max-width 约束、长角色名 break-words 不撑爆、不引发横滚。几何断言，禁止 toBeVisible 充数。
          expect(visible, `${vp.name} D2 role picker 应渲染`).toBeTruthy()
          expect(floatingBox, `${vp.name} D2 floatingBox 应可测`).not.toBeNull()
          expect(symptoms, `${vp.name} D2 应无越界/超宽/遮挡症状（实测: ${symptoms.join('; ') || '无'}）`).toEqual([])
          const d2HScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
          expect(d2HScroll, `${vp.name} D2 打开后不得引发横滚`).toBeFalsy()
          await page.locator(triggerSel).click().catch(() => {})
        } else {
          record({
            id: 'D2', viewport: vp.name, target: 'role picker @角色', selector: pickerSel,
            triggerBox: await boxOf(page, triggerSel), floatingBox: null,
            symptoms: ['@角色按钮 disabled（无 active session，picker 不可开）'],
            severity: 'low', reference: 'R1/R2/R5', screenshot: await shot(page, `${vp.name}-D2-role-picker-disabled`),
            suggestedTask: '观察：无会话时禁用属预期；有会话时定位见 D2 修复建议',
          })
        }
      }

      // ---- O1/O2: 移动抽屉（artifact overlay / sidebar drawer）----
      if (isMobile) {
        // O1 已在流程开头审计并夹起抽屉；此处仅测 O2 sidebar drawer：打开后断言 backdrop 覆盖 + 抽屉在视口内
        await page.locator('[data-testid="open-sidebar"]').click()
        const o2Sel = '[data-testid="sidebar-region"]'
        const o2Box = await boxOf(page, o2Sel)
        const sbBackdropBox = await boxOf(page, '[data-testid="sidebar-backdrop"]')
        const o2Symptoms: string[] = []
        if (o2Box) o2Symptoms.push(...inViewport(o2Box, vp.width, vp.height))
        if (!sbBackdropBox) o2Symptoms.push('sidebar 抽屉缺 backdrop')
        else if (sbBackdropBox.width < vp.width - 1 || sbBackdropBox.height < vp.height - 1) o2Symptoms.push('backdrop 未覆盖全视口')
        record({
          id: 'O2', viewport: vp.name, target: 'sidebar drawer（移动抽屉）', selector: o2Sel,
          triggerBox: null, floatingBox: o2Box, symptoms: o2Symptoms,
          severity: o2Symptoms.length ? 'medium' : 'ok',
          reference: 'R9（fixed inset + backdrop 母版对照）', screenshot: await shot(page, `${vp.name}-O2-sidebar-drawer`),
          suggestedTask: o2Symptoms.length ? 'FIX-O2: sidebar 抽屉 backdrop/越界修复' : '无（实现规范，回归确认）',
        })
        await page.locator('[data-testid="sidebar-backdrop"]').click().catch(() => {})
      } else {
        // 桌面态：artifact 抽屉为 static 第三栏，backdrop 应 lg:hidden（display:none，不可见不拦截）
        const visBackdrop = await page.locator('[data-testid="artifact-backdrop"]:visible').count()
        const o1Symptoms = visBackdrop > 0 ? ['桌面态不应显示 artifact-backdrop（应 lg:hidden）'] : []
        record({
          id: 'O1', viewport: vp.name, target: 'artifact panel overlay（桌面第三栏）', selector: '[data-testid="artifact-overlay"]',
          triggerBox: null, floatingBox: await boxOf(page, '[data-testid="artifact-overlay"]'), symptoms: o1Symptoms,
          severity: o1Symptoms.length ? 'medium' : 'ok',
          reference: 'R9（桌面 lg:static 无可见 backdrop）', screenshot: await shot(page, `${vp.name}-O1-artifact-desktop`),
          suggestedTask: o1Symptoms.length ? 'FIX-O1: 桌面 backdrop 泄漏' : '无（桌面无可见 backdrop，回归确认）',
        })
        expect(visBackdrop, `${vp.name} 桌面态不应显示 artifact-backdrop`).toBe(0)
      }

      // 全局：任意浮层操作后不得引发横向滚动（只读记录，不 fail-hard，使审计 findings 完整落盘）
      await page.mouse.move(0, 0)
      const hScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      record({
        id: 'GLOBAL-HSCROLL', viewport: vp.name, target: '页面横向滚动（浮层操作后）', selector: 'html',
        triggerBox: null, floatingBox: null,
        symptoms: hScroll ? ['浮层操作后页面出现横向滚动条'] : [],
        severity: hScroll ? 'high' : 'ok',
        reference: 'R3/R4（浮层应被 clamp/portal，不撑出横滚）',
        screenshot: await shot(page, `${vp.name}-GLOBAL-hscroll`),
        suggestedTask: hScroll ? '排查触发横滚的浮层并 portal/clamp' : '无（无横滚）',
      })
      await context.close()
    })
  })
}
