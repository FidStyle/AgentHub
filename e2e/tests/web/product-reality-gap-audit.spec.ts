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
  test('PRGA-001 Mobile RN ChatScreen 已接真实 runtime（sendChat → /api/chat，非 setTimeout 回显）— MOBILE-RN-CHAT-RUNTIME-001 已修复', () => {
    const src = read('apps/mobile/src/screens/ChatScreen.tsx')
    expect(src).toMatch(/sendChat\(/)
    expect(src).not.toMatch(/setTimeout|\[Agent\] 收到/)
    const client = read('apps/mobile/src/lib/chatClient.ts')
    expect(client).toMatch(/\/api\/chat/)
  })

  test('PRGA-002 Desktop handleSend 已接真实 runtime.execute（不再硬编码 success echo）— DESKTOP-SESSION-RUNTIME-001 已修复', () => {
    const src = read('apps/desktop/src/renderer/components/shell/DesktopAgentSession.tsx')
    expect(src).toMatch(/runtime\.execute\(/)
    expect(src).toMatch(/exitCode/)
    expect(src).not.toMatch(/addActivity\(\{\s*type:\s*'action',\s*status:\s*'success'/)
  })

  test('PRGA-003 Desktop 诊断/继续/重试/停止 不再是死按钮（disabled + title 原因）— DESKTOP-SESSION-RUNTIME-001 已修复', () => {
    const src = read('apps/desktop/src/renderer/components/shell/DesktopAgentSession.tsx')
    expect(src).toContain('诊断')
    expect(src).toContain('停止')
    expect(src).toMatch(/title="诊断 Claude Code \/ Codex 的安装、认证和可启动状态"/)
    expect(src).toMatch(/handleStop/)
    expect(src).toMatch(/当前桌面端未提供停止能力/)
  })

  test('PRGA-004 Web PlanCard/ActionCard 已被 OrchestratorPanel 真实引用（不再是僵尸组件）— WEB-ORCHESTRATOR-UI-001 已修复', () => {
    expect(existsSync(join(REPO, 'apps/web/components/orchestrator/PlanCard.tsx'))).toBe(true)
    let refs = ''
    try {
      refs = execSync(
        "grep -rn 'PlanCard\\|ActionCard' apps/web/app apps/web/components --include='*.tsx' | grep -v 'orchestrator/PlanCard.tsx' | grep -v 'orchestrator/ActionCard.tsx'",
        { cwd: REPO, encoding: 'utf8' },
      )
    } catch {
      refs = ''
    }
    expect(refs).toMatch(/OrchestratorPanel\.tsx/)
  })

  test('PRGA-005 Web ArtifactPanel 三 Tab 已接真实数据（fetch /api，非恒空态）— ARTIFACT-PANEL-DATA-001 已修复', () => {
    const src = read('apps/web/components/workspace/ArtifactPanel.tsx')
    expect(src).toMatch(/useSessionMessages|fetch\(/)
    expect(src).toMatch(/\/api\/role-agents|\/api\/messages/)
  })

  test('PRGA-006 worker 默认 executor 不再是 FakeExecutor', () => {
    const src = read('apps/web/server/runtime-worker.ts')
    expect(src).toMatch(/RUNTIME_EXECUTOR === 'fake'/)
    expect(src).toMatch(/new CliRuntimeExecutor/)
    expect(src).not.toMatch(/executor: RuntimeExecutor = new FakeExecutor\(\)/)
    const exec = read('apps/web/lib/runtime/executor.ts')
    expect(exec).toContain('已收到你的请求，这是运行时执行器返回的回复')
  })

  test('PRGA-007/008/009/010 门禁 spec 已接真实主链路（无 page.route mock）— TEST-REALITY-GATE-001 已修复', () => {
    for (const p of [
      'e2e/tests/artifact.spec.ts',
      'e2e/tests/messaging.spec.ts',
      'e2e/tests/workspace.spec.ts',
      'e2e/tests/web/p0-main-flow.spec.ts',
    ]) {
      const src = read(p)
      expect(src).not.toMatch(/page\.route\(/)
      expect(src).toMatch(/page\.request\.(post|get)|\/api\/(workspaces|chat|messages|role-agents|sessions)/)
    }
  })
})
