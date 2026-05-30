import { test, expect } from '@playwright/test'

/**
 * PRODUCT-REALITY-GAP-AUDIT-001 — 只读审计锚点 spec（read-only audit anchor）。
 *
 * 用途：把本次审计发现的「假交互/占位/恒空态」结构固化为可执行的结构断言锚点，
 * 让后续修复任务（PRGA-001..011）有一个明确的「修复前=此状态」基线。
 *
 * 重要约定：
 *   - 本 spec 不验证产品功能"正确"，而是断言"当前缺口存在"的结构事实（源码层）。
 *   - 这些断言是审计证据，不是绿灯门禁；修复落地后应被对应任务的真实门禁 spec 取代/反转。
 *   - 纯静态源码读取断言，不依赖 dev server / Electron / Metro（这些在审计环境 BLOCKED，
 *     真实用户态截图为 DEFERRED，见 product-reality-gap-audit-001-report.md §2）。
 *
 * 详见：research/execution-reports/product-reality-gap-audit-001-report.md
 *       research/execution-reports/product-reality-gap-audit-001-findings.json
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const REPO = join(__dirname, '..', '..', '..')
const read = (p: string) => readFileSync(join(REPO, p), 'utf8')

test.describe('PRODUCT-REALITY-GAP-AUDIT-001 假交互/占位结构锚点（审计证据，非绿灯门禁）', () => {
  test('PRGA-001 Mobile RN ChatScreen 仍是 setTimeout 回显、无网络请求', () => {
    const src = read('apps/mobile/src/screens/ChatScreen.tsx')
    expect(src).toContain('setTimeout')
    expect(src).toContain('[Agent] 收到')
    expect(src).not.toMatch(/fetch\(|\/api\/chat|\/api\/messages/)
  })

  test('PRGA-002 Desktop handleSend 仍只 addActivity echo + 硬编码 success', () => {
    const src = read('apps/desktop/src/renderer/components/shell/DesktopAgentSession.tsx')
    expect(src).toMatch(/addActivity\(\{[^}]*status:\s*'success'/)
    expect(src).not.toMatch(/runtime_invoke|runtime:execute|ipcRenderer|deviceChannel/)
  })

  test('PRGA-003 Desktop 诊断/继续/重试/停止 按钮仍无 onClick', () => {
    const src = read('apps/desktop/src/renderer/components/shell/DesktopAgentSession.tsx')
    const controls = src.slice(src.indexOf('诊断'), src.indexOf('停止') + 4)
    expect(controls).toContain('诊断')
    expect(controls).toContain('停止')
    expect(controls).not.toContain('onClick')
  })

  test('PRGA-004 Web PlanCard/ActionCard 仍零引用（僵尸组件）', () => {
    expect(existsSync(join(REPO, 'apps/web/components/orchestrator/PlanCard.tsx'))).toBe(true)
    let refs = ''
    try {
      refs = execSync(
        "grep -rn 'PlanCard\\|ActionCard' apps/web/app apps/web/components --include='*.tsx' | grep -v 'orchestrator/PlanCard.tsx' | grep -v 'orchestrator/ActionCard.tsx'",
        { cwd: REPO, encoding: 'utf8' },
      )
    } catch {
      refs = '' // grep exit 1 = no matches = 仍是僵尸组件
    }
    expect(refs.trim()).toBe('')
  })

  test('PRGA-005 Web ArtifactPanel 三 Tab 仍恒空态、无数据获取', () => {
    const src = read('apps/web/components/workspace/ArtifactPanel.tsx')
    expect((src.match(/variant="empty"/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect(src).not.toMatch(/useRoleAgents|fetch\(|\/api\//)
  })

  test('PRGA-006 worker 默认 executor 仍为 FakeExecutor（非真实 LLM）', () => {
    const src = read('apps/web/server/runtime-worker.ts')
    expect(src).toMatch(/return new FakeExecutor\(\)/)
    const exec = read('apps/web/lib/runtime/executor.ts')
    expect(exec).toContain('已收到你的请求，这是运行时执行器返回的回复')
  })

  test('PRGA-007/008/009 mock 门禁 spec 仍用 page.route 伪造主链路', () => {
    expect(read('e2e/tests/artifact.spec.ts')).toContain('page.route')
    const messaging = read('e2e/tests/messaging.spec.ts')
    expect(messaging).toContain("page.route('**/api/chat'")
    expect(read('e2e/tests/workspace.spec.ts')).toContain('page.route')
  })
})
