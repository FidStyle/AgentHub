# WEB-WORKSPACE-LAYOUT-UAT-001 执行报告

> Web (:3000) workspace 按钮位置、入口排版与交互可用性修复 + 真实浏览器布局 UAT。
> Ralph session `ralph-20260530-223110`，完成时间 2026-05-30。

## 1. 范围与边界

- **in**：`apps/web/components/workspace/*` 布局/位置/交互可用性；`e2e/tests/web` workspace 用例 + 几何断言 helper；regression-ledger / project-tracker 登记。
- **out**：后端 API 业务逻辑、Runtime/worker、Desktop/Mobile 原生、`refer_proj/*`。向后兼容既有 workspace 功能逻辑，仅修 UI。

## 2. 根因与修复（analyze ANL-web-workspace-layout-uat-2026-05-30）

| RC | 级别 | 问题 | 修复 |
| --- | --- | --- | --- |
| RC1 | P0 | 三栏布局移动失稳：固定 `grid-cols-[280px_1fr_320px]` 无断点，移动宽度横向溢出 + 三栏挤压不可用 | `WorkspaceShell.tsx` 响应式 `lg:grid-cols-[280px_minmax(480px,1fr)_320px]`（开右栏）/`[280px_minmax(480px,1fr)]`（关），`overflow-x-hidden`；<lg 左栏转 `fixed` 抽屉 + backdrop、右栏转 `fixed` overlay 不挤压主聊天区 |
| RC2 | P1 | 新建会话按钮位置正确但无 boundingBox 几何 + 点击真实创建/选中/输入可用联合断言 | 补 testid 锚点 + `assertRightOf` + 点击行为断言 |
| RC3 | P1 | workspace 切换入口展开几何 + 列表落左栏内断言缺失 | `assertWithinContainer(dropdown, sidebar-region)` |
| RC4 | P1 | @角色按钮 + picker 贴近/不遮挡输入/发送断言缺失 | `assertAdjacent` + `assertNotOverlapping(picker, input/send)` |
| RC5 | P1 | 发送按钮右侧三态位置稳定断言缺失 | `assertRightOf(send, input)` + 三态 x 偏移 ≤2px |
| RC6 | P1 | Artifact 面板入口/关闭 + 中栏最小宽度断言缺失 | `assertRightOf(toggle, h2)` + 开合后中栏 `assertMinWidth ≥480` |

## 3. 交付物

- `apps/web/components/workspace/WorkspaceShell.tsx`：响应式三栏 + 中栏 `minmax(480,1fr)` 守卫 + 移动抽屉/overlay。
- `apps/web/components/workspace/{ChatPanel,ArtifactPanel,Sidebar}.tsx`：testid 锚点（供几何断言）。
- `e2e/helpers/visual-assertions.ts`：新增 `assertRightOf`/`assertAdjacent`/`assertWithinContainer`/`assertMinWidth`/`assertNotOverlapping`（全部基于真实 `boundingBox()`，box 为 null 即 fail）。
- `e2e/tests/web/web-workspace-layout-uat.spec.ts`：3 视口（1440×900 / 1280×800 / 768）真实浏览器截图 + boundingBox 几何 + 点击行为断言。

## 4. 测试证据（真实浏览器，无主链路 mock）

- 命令：`playwright test --config=e2e/playwright.config.ts --project=web-desktop web-workspace-layout-uat.spec.ts`
- 结果：**3 passed (6.5s)**，真实 localhost:3000 + P0 postgres 种子 + 真实 auth cookie（global-setup 供给）。
- 证据图：`e2e/artifacts/web-workspace-layout/{desktop-1440x900,desktop-1280x800,narrow-768}.png`（真实渲染 53/51/32KB，非 baseline 对比）。
- verification.json PASS（`passed=true`，`gaps=[]`）；review.json PASS（verdict≠BLOCK，0 critical/0 high，7 按钮 onClick 真实结果非空壳）；uat.md 3/3 通过。
- 反作弊核查：修改文件无 `@ts-ignore`/`as any`/`.skip`；`toBeVisible` 仅作前置门，每条均配几何/行为断言；无 `toHaveScreenshot` baseline 对比；`apps/web tsc --noEmit` 通过。

## 5. 约束合规

- 未 `git add .`，仅精确提交本任务相关文件；中文 commit；最终 git status clean。
- 全局中文文案，无英文用户文案，无毛坯 HTML/无样式 UI。
- Runtime API Key 未暴露为主流程表单。
- 向后兼容：业务逻辑零改，仅 UI 布局/位置/交互。

## 6. 已知环境项（非缺陷）

首跑因残留 dev server 占用 :3000（EADDRINUSE）+ 多 worker 共享单用户数据竞争导致 UAT 超时；清理残留进程后干净复跑 3/3 通过。该测试隔离脆弱性属既有套件问题，已登记 `REG-20260530-002`（P1），不阻塞本任务关闭。

外部评审 codex delegate 因 ACE 网关 502 中断无产出，post-review/post-test/post-goal-audit 决策门基于真实 artifact 实读内联评估通过。
