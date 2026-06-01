# PRD 反查缺口审计（2026-06-01）

## 结论

本轮没有改产品代码，只从 `research/prd.md` 的 P0 FR 反查当前实现。结论是：问题不止“真实 runtime 链路是否跑通”，还包括 P0 PRD 功能只做薄壳、报告与代码漂移、以及不该保留的旧入口/未挂载组件/静态假数据。

本轮未重新跑 Web/Electron/Mobile UAT；以下是代码级审计结果，不能替代最终实测。

## 发现清单

| ID | 分类 | FR | 代码证据 | 问题 |
| --- | --- | --- | --- | --- |
| PBA-001 | `missing_required` / security | `FR-WS-001`, `FR-DESK-001` | `apps/web/app/api/workspaces/route.ts` | `local_desktop` 创建只检查 `desktop.error`，没有在 `desktop.ok === false` 时返回 409；当前无在线 Desktop 仍可能创建本地工作区，和 PRD“Local Desktop Workspace 只能通过已认证且在线 Connector”冲突，也和旧报告“未连接时 409”冲突。 |
| PBA-002 | `missing_required` / security | `FR-AUTH-001`, `FR-PERM-001`, `FR-ORCH-001` | `apps/web/app/api/plans/route.ts`, `apps/web/app/api/actions/route.ts` | `GET/POST /api/plans` 与 `GET/POST /api/actions` 只 requireAuth，没有校验 `session_id -> workspace.owner_id`；任意登录用户若知道 session_id 可列出或创建 plan/action。 |
| PBA-003 | `partial_shell` | `FR-CHAT-001`, `FR-ORCH-001` | `apps/web/components/workspace/ChatPanel.tsx`, `apps/web/store/session-store.ts`, `apps/web/app/api/chat/route.ts` | 只支持单个 `selectedRole`。PRD 要求未 @ 默认 Orchestrator、@ 多角色进入 Orchestrated Flow；当前无多选 @、无多角色 session participants、无默认 Orchestrator 路由。 |
| PBA-004 | `partial_shell` | `FR-ORCH-001` | `apps/web/components/orchestrator/OrchestratorPanel.tsx`, `apps/web/app/api/plans/[planId]/confirm/route.ts` | 编排面板只是读取已有 plans/actions；`/api/chat` 不会生成计划或澄清问题，confirm 只把 ready nodes 标记为 ready，没有调度 Role Agent 执行节点、汇总结果或失败恢复。 |
| PBA-005 | `partial_shell` | `FR-CTX-001`, `FR-RUNTIME-001` | `apps/web/components/workspace/ArtifactPanel.tsx`, `apps/web/app/api/messages/[id]/route.ts`, `apps/web/lib/runtime/gateway.ts` | 后端只支持 `is_pinned` PATCH，但主 UI 没有 pin/handoff 入口；Context 面板只展示已存在数据。`native_session_id` 有 schema 但没有写入或 resume/continue 逻辑。 |
| PBA-006 | `partial_shell` | `FR-ARTIFACT-001`, `FR-RESULT-001` | `apps/web/components/workspace/ChatPanel.tsx`, `apps/web/components/workspace/ArtifactPanel.tsx`, `apps/web/app/m/preview/page.tsx` | 聊天消息正文仍是 `<p>` 文本，不支持 PRD 要求的 Markdown、代码块高亮/复制、Diff/Result 卡片内联展示；Mobile 预览页显示“文件内容将在此显示”占位。 |
| PBA-007 | `partial_shell` | `FR-ACTION-001`, `FR-PERM-001` | `apps/web/app/api/actions/[actionId]/approve/route.ts`, `apps/web/lib/orchestrator/permission-engine.ts` | Action 可以创建/批准，但批准后只改状态，没有进入 Desktop/Cloud Action executor；权限策略是默认常量，未体现 Workspace/Session 两级策略覆盖。 |
| PBA-008 | `partial_shell` / `stale_or_ghost` | `FR-NOTIFY-001`, `FR-DESK-001` | `apps/web/components/orchestrator/NotificationBell.tsx`, `apps/desktop/src/renderer/store/console-store.ts`, `apps/desktop/src/renderer/components/shell/DesktopPolicyPage.tsx` | Web `NotificationBell` 未被挂载；Desktop 本机策略页的授权记录来自 zustand 静态 seed（含 `rm -rf src/legacy/*`），不是 `/api/notifications` 或真实授权记录。 |
| PBA-009 | `stale_or_ghost` | `FR-DESK-001`, `FR-UI-001` | `apps/desktop/src/renderer/components/RuntimeConfigPage.tsx`, `ConnectorConsole.tsx`, `BindingFlow.tsx`, `ActivityLog.tsx`, `RuntimeStatus.tsx` | 多个旧 Desktop 组件未被 `App.tsx` 挂载，但仍含旧页面语义和 test id，容易让 grep/测试误判为功能存在。 |
| PBA-010 | `stale_or_ghost` / doc drift | `FR-DESK-001` | `research/product/product-design.md` §5.2.1 | 产品设计仍写 Desktop 左侧导航包含“最近 Session”；代码已删除最近会话入口，文档需要按“真实会话恢复链路完成前不提供独立入口”同步。 |
| PBA-011 | `implemented_unverified` | `FR-AUTH-001` | `e2e/tests/desktop/p0-auth-flow.spec.ts` | Desktop 登录/绑定 E2E 仍依赖 `WEB_BASE_URL`、`TEST_AUTH_COOKIE`、`DESKTOP_APP_PATH` skip；不能合并进“账号登录全链路已实测通过”。 |
| PBA-012 | `implemented_unverified` | `FR-MOB-001` | `apps/mobile/src/screens/ChatScreen.tsx`, `apps/web/app/m/*` | PWA `/m` 有真实 API 链路；原生 RN App 仍依赖 env 注入 session/token，真实设备/模拟器 GUI 未自动验收。不能说 Mobile 端全部实际通过，只能说 PWA/逻辑层覆盖。 |

## 按 PRD 聚合的风险

- 主用户旅程第 7-11 步仍不完整：多角色选择、Orchestrator 澄清/计划/分派、结果卡和 Action 执行没有形成完整闭环。
- 安全边界有 P0 级缺口：plans/actions 缺 session owner 校验；local_desktop 创建门禁与报告不一致。
- “保留但不真实”的入口仍存在：Desktop 静态授权记录、未挂载旧组件、Mobile preview 占位、未挂载 NotificationBell。
- 测试证据口径需要拆开：现有报告可证明部分真实链路，但不能证明所有 PRD P0 条目都已实际通过。

## 建议优先级

1. P0 安全与执行域：修 `local_desktop` 创建 409；补 plans/actions session ownership。
2. P0 主旅程：补多角色 @、默认 Orchestrator、Orchestrator plan 生成/confirm 后调度。
3. P0 假入口清理：删除或接真实数据的 Desktop 静态授权记录、未挂载旧组件、Mobile preview 占位。
4. P0/P1 体验闭环：Markdown/代码块/Diff/ResultCard 内联渲染、pin/handoff、Action executor。
5. 验收口径：把 Desktop OAuth、RN GUI、真实 CLI/worker、PWA 分开报告，禁止写“全部通过”。

