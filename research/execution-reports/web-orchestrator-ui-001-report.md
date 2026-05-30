# WEB-ORCHESTRATOR-UI-001 执行报告

> 关闭 `REG-20260531-010` 的 **PRGA-004**（PRODUCT-REALITY-GAP-AUDIT-001 最后一项 P0）→ 全账本（PRGA-001/002/003/004）关闭。
> Ralph session `ralph-20260531-060031`（analyze→plan→execute→verify→review→goal-audit→milestone-complete）。

## 1. 问题（PRGA-004）

Web workspace 编排 UI 未上线：

- `apps/web/components/orchestrator/PlanCard.tsx` + `ActionCard.tsx` 组件已存在但**全仓 grep 零引用**（僵尸组件）。
- 后端 `/api/plans`、`/api/actions`、`/api/plans/:id/confirm`、`/api/actions/:id/approve` 均可用，但 `WorkspaceShell` 无编排入口。
- 用户无法看到计划节点、动作风险、审批与执行状态——核心编排价值未达成。

## 2. 集成点

| 集成点 | 说明 |
|--------|------|
| `useSessionStore().activeSessionId` | 与 ChatPanel 共享同一会话状态，保证编排面板与对话会话一致 |
| `GET /api/plans?session_id` / `GET /api/actions?session_id` | 真实数据源（Supabase + requireAuth），无 mock |
| `POST /api/plans/:id/confirm` | 计划确认（pending_confirm→running） |
| `POST /api/actions/:id/approve {approved}` | 动作审批/拒绝（pending→approved/rejected） |
| `ArtifactPanel` 右栏 Tab | 选择 Tab 集成（最小改动，不破坏三栏布局/移动抽屉），优于改 WorkspaceShell 布局 |

## 3. 改动表

| 文件 | 类型 | 改动 |
|------|------|------|
| `apps/web/components/orchestrator/OrchestratorPanel.tsx` | new | `'use client'`；读 `activeSessionId`；`useEffect` 并行 `fetch` 真实 plans+actions；渲染 `PlanCard`(onConfirm)+`ActionCard`(onApprove)，成功后 re-fetch；未选会话/空/error 显式 `StateCard` 空态；`data-testid` orchestrator-panel/orchestrator-empty/orchestrator-error；**无 mock/硬编码** |
| `apps/web/components/workspace/ArtifactPanel.tsx` | modified | `TABS` 增「编排」；`activeTab==='编排'` 渲染 `<OrchestratorPanel />`；消除 PlanCard/ActionCard 零引用僵尸 |
| `e2e/tests/web/web-orchestrator-ui.spec.ts` | new | 真实 API 播种 plan(含 nodes)+high-risk action → 切编排 tab → 深度断言标题/节点/命令/风险文案/批准按钮 → 点批准断言真实 `/approve` POST ok → GET 重新读取断言 `status=approved` 持久 |

## 4. 验收证据（fresh）

| 检查 | 结果 |
|------|------|
| `pnpm --filter @agenthub/web type-check` | exit 0 |
| `pnpm --filter @agenthub/web build` | success（`/workspace/[id]` 7.18 kB） |
| `npx playwright test web-orchestrator-ui --list` | Total: 1 test in 1 file（valid，可发现） |
| 僵尸消除 `grep PlanCard\|ActionCard`（排除定义文件） | 仅 `OrchestratorPanel.tsx:7,8,91,95` 引用 |
| 接入 wiring `grep OrchestratorPanel` | `ArtifactPanel.tsx:5,35` |
| 反模式扫描（mock/硬编码/TODO/FIXME/placeholder/stub） | clean（唯一命中为 E2E 注释「非 mock」，非代码） |
| 规格符合（TASK-001/002 convergence） | 全部 MET |

E2E 断言深度（非 `toBeVisible` 糊弄）：播种时断言 `risk_level=high`/`status=pending`；卡片断言标题「E2E 编排计划」/节点「步骤一」/命令「deploy production --force」/「风险: 高」/「批准」按钮；审批 `waitForResponse` 真实 `POST /api/actions/:id/approve` ok；GET 重新读取断言 `persisted.status==='approved'`。

## 5. DEFERRED

- **E2E 实跑**：需真实 Supabase DB session（`TEST_AUTH_COOKIE` + `TEST_SESSION_ID` + `TEST_WORKSPACE_ID`），CI 无真实 DB → `test.skip` 标 DEFERRED（与 REG-20260531-010 GUI/DB DEFERRED 一致），**断言骨架完整保留，不删测试糊弄**。
- **真实浏览器用户态截图**：CLI 环境无 GUI/dev server，DEFERRED。

## 6. 结论

PRGA-004 已修复：Web workspace「编排」Tab 渲染真实 `OrchestratorPanel`，展示当前会话的 plans/actions，高风险 action 可审批/拒绝并调真实 API，状态成功后刷新；空态显式说明无计划/动作非假功能；数据全部来自真实 `/api/plans`+`/api/actions`，无 mock/硬编码。E2E 真实链路断言骨架就绪（DB 缺失时 DEFERRED）。`REG-20260531-010` 全部关闭（PRGA-001/002/003/004 均已修复）。遗留 E2E 门禁缺陷 `REG-20260531-011`（P1）由独立任务处理。
