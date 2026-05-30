# ARTIFACT-PANEL-DATA-001 执行报告

> 关闭 `REG-20260530-007` / **PRGA-005**（PRODUCT-REALITY-GAP-AUDIT-001）：Web ArtifactPanel 三 Tab 恒空态接真实数据。
> Ralph session `ralph-20260531-063611`（analyze→plan→execute→verify→review→goal-audit→milestone-complete）。

## 1. 问题（PRGA-005 / REG-20260530-007）

`apps/web/components/workspace/ArtifactPanel.tsx` 的「产物」「上下文」「Agents」三 Tab 对用户展示为可用功能，但代码硬编码三个 `<StateCard variant="empty">`、无任何 fetch。同 workspace 的 `/api/role-agents` 返回非空（含「架构师」），但「Agents」Tab 恒显「暂无 Agent」——假空态。「编排」Tab 已由 WEB-ORCHESTRATOR-UI-001 接入真实 `OrchestratorPanel`（需保留）。

## 2. 集成点

| 集成点 | 说明 |
|--------|------|
| `useSessionStore().activeWorkspaceId` | Agents Tab 取数键 |
| `useSessionStore().activeSessionId` | 上下文/产物 Tab 取数键（与 ChatPanel/OrchestratorPanel 共享） |
| `GET /api/role-agents?workspace_id` | 真实 role agents（Supabase + requireAuth；空时后端自动 seed 架构师） |
| `GET /api/messages?session_id` | 真实消息（含 `metadata`/`is_pinned`/`message_type`），上下文与产物从中派生 |
| 编排 Tab | `<OrchestratorPanel />` 渲染保留不动 |

## 3. 改动表

| 文件 | 类型 | 改动 |
|------|------|------|
| `apps/web/components/workspace/ArtifactPanel.tsx` | modified | 删除三个硬编码恒空 `StateCard`；新增 `AgentsTab`（fetch role-agents，snake_case 渲染 name/role_type/capabilities/is_orchestrator）、`useSessionMessages()` hook、`ContextTab`（筛 `is_pinned||metadata` 非空）、`OutputTab`（筛 `message_type∈{plan_card,result_card}||metadata.artifact`）；各 Tab loading/error/真实空态/未选态显式；`data-testid` artifact-agents/artifact-context/artifact-output(+*-error)；编排 Tab `<OrchestratorPanel />` 保留；复用 StateCard/Button 共享组件 |
| `e2e/tests/web/artifact-panel-data.spec.ts` | new | 真实 API 播种 role agent+session+pinned 上下文+result_card 产物（非 `page.route` mock）→ 切三 Tab 深度断言真实数据文本 + 交叉校验 `GET /api/role-agents`；无 DB env → `test.skip` DEFERRED 保留断言骨架 |

## 4. 验收证据（fresh）

| 检查 | 结果 |
|------|------|
| `pnpm --filter @agenthub/web type-check` | exit 0 |
| `pnpm --filter @agenthub/web build` | exit 0（`/workspace/[id]` 7.68 kB） |
| `npx playwright test artifact-panel-data --list` | Total: 1 test in 1 file（valid） |
| 编排 Tab 保留 `grep OrchestratorPanel` | `ArtifactPanel.tsx:5,132` |
| 反模式扫描（page.route/mock/硬编码/TODO/FIXME/placeholder/stub） | clean（唯一命中为 E2E 注释「非 mock」「非硬编码」，非代码） |
| 规格符合（TASK-001/002 convergence） | 全部 MET |

E2E 断言深度（非 `toBeVisible` 糊弄）：播种后断言 Agents tab `getByText('E2E 测试工程师')`、上下文 tab `getByText('E2E 引用上下文片段')`、产物 tab `getByText('E2E 产物结果卡片')`，并 `page.request.get('/api/role-agents')` 交叉校验播种 agent.id 在真实返回中。

## 5. DEFERRED

- **E2E 实跑**：需真实 Supabase DB（`TEST_AUTH_COOKIE` + `TEST_WORKSPACE_ID`），CI 无真实 DB → `test.skip` 标 DEFERRED（与 REG-20260531-010 GUI/DB DEFERRED 一致），断言骨架完整保留不删糊弄。
- **真实浏览器用户态截图**：CLI 环境无 GUI/dev server，DEFERRED。
- **独立 artifacts 表/端点**：当前无 `/api/artifacts`，产物从 messages metadata 派生即可；建独立产物端点 out-of-scope。

## 6. 结论

PRGA-005 / REG-20260530-007 已修复：ArtifactPanel 三 Tab 接真实 `/api/role-agents` + `/api/messages`，Agents 展示真实 role agents，上下文/产物从 session messages 真实派生，空态仅在真实数据为空时显示（非硬编码假空态）；编排 Tab 保留。E2E 真实数据断言骨架就绪（DB 缺失时 DEFERRED）。遗留 E2E 门禁缺陷（`artifact.spec.ts` 等 mock 主链路）由 `REG-20260531-011`（P1）独立处理。
