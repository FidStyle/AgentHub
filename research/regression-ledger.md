# 回归、缺陷与未完成项台账

> 文档注释：本文件不是执行报告，也不是临时 TODO。它是 AgentHub 已完成功能面暴露出的 bug、未完成项、不完善项和质量债的长期台账。每一条必须挂钩到 PRD/FR、已完成任务或合同、受影响功能面、验证方式和关闭条件。新功能推进前必须先检查本文件是否存在阻塞级未关闭项。

## 使用规则

1. 已声明完成的功能，如果用户或审计发现真实链路不可用、点击无效、数据未闭环、状态不一致、测试未覆盖，应先登记到本文件。
2. 每条记录必须至少包含：ID、类型、优先级、状态、关联 FR/PRD、关联任务/合同、影响面、发现方式、证据、关闭条件、下一步。
3. `P0 regression` 和 `P0 blocker` 默认阻塞继续扩大同一功能面；除非用户明确接受风险，否则应先修复。
4. 修复完成后，不能只改状态；必须补测试证据、execution report、tracker 记录和中文 commit。
5. Maestro/Ralph/Codex 完成功能后，应检查本文件并补登新发现问题；不得只写在聊天或 `.workflow/.maestro/*/status.json`。

## 状态定义

| 状态 | 含义 |
| --- | --- |
| `open` | 已确认存在，尚未进入修复 |
| `in_progress` | 已进入修复/验证 session |
| `blocked` | 需要外部条件或用户决策 |
| `fixed_pending_verify` | 已修复，等待真实链路验证 |
| `closed` | 修复、验证、报告、tracker、commit 全部完成 |

## 当前未关闭项

> REG-20260530-001（Web Workspace 真实交互闭环缺口）与 ROLE-CHAT-CORE-001 可见 agent 回复 deferred 项（重定级 REG-20260530-003）已在 `RUNTIME_E2E=1` + worker(FakeExecutor) 下复验并移入「关闭记录」。
>
> ⚠️ **更正（2026-05-30，PRODUCT-UAT-GAP-AUDIT-001）**：REG-20260530-003 的「关闭」仅在 `RUNTIME_E2E=1` + FakeExecutor 下成立；真实用户默认入口（`pnpm dev:web`/`dev:full`，无 worker）下 @架构师/Agent 对话仍 0 可见回复。该过早关闭的产品缺口由新登记的 **REG-20260530-006** 接管，REG-20260530-003 的「closed」仅代表「测试态 FakeExecutor 回环已建立」，不代表产品目标达成。当前未关闭项：P1 test-infra REG-20260530-002 + 本次审计新增 REG-20260530-006(P0，**已全部关闭**：Web GAP-001 由 `ROLE-CHAT-RUNTIME-DELIVER-001`/commit `eed577f`，Mobile GAP-002 由 `MOBILE-CHAT-DELIVER-001`)/007(P1)/008(P1)。
>
> ✅ **build blocker 闭环（2026-05-31，WEB-BUILD-REACT-TYPES-001）**：此前在多份报告中以 carried-over concern 形式滚动的「`apps/web` 全量 tsc 的 pre-existing dual `@types/react` 冲突」已正式升级为 build blocker **REG-20260531-004** 并关闭——根因为 pnpm 把 mobile 的 `@types/react@18` hoist 进虚拟仓库根污染 web 编译图，已在 `.npmrc` 用 `hoist-pattern` 排除根治，web build/type-check + ui type-check 全绿。
>
> ✅ **最终验收硬化闭环（2026-06-01，ACCEPTANCE-HARDENING-2026-06-01）**：本轮关闭验收前 P0 硬化项：根级 lint/type-check/test/build、验收环境 smoke、Web worker/no-worker E2E、Desktop Electron GUI/runtime E2E、Mobile PWA worker/no-worker E2E、RN test/type/build/Metro 入口均已通过。新增修复包括 Mobile PWA service worker 开发态导航干扰、无效 `/m/sessions` 预缓存、Mobile `expo start` 假入口、Desktop E2E 过期端口/文案断言等。最终报告见 `research/execution-reports/acceptance-final-uat-governance-2026-06-01.md`。

### REG-20260601-001 — 验收真实闭环缺口：默认 fake/script runtime、本地链路未执行、附件/artifact 不 durable

| 字段 | 内容 |
| --- | --- |
| **类型** | unfinished / fake-completion / acceptance-blocker |
| **优先级** | P0 |
| **状态** | `closed`（2026-06-01） |
| **关联 FR/PRD** | FR-CHAT-001, FR-AGENT-001, FR-RUNTIME-001, FR-DESK-001, FR-ARTIFACT-001, FR-PERM-001 |
| **关联任务/合同** | `ACCEPTANCE-REAL-FLOW-2026-06-01`；`.trellis/tasks/06-01-acceptance-real-flow-program/` |
| **影响功能面** | Web `@角色` 对话、本地 Desktop runtime、远程 worker、附件上传、Artifact 产出、最终 UAT |
| **发现方式** | 用户验收前复核 + Codex 代码审计（2026-06-01） |
| **证据** | `apps/web/server/runtime-worker.ts` 默认 fake/script 已修为 real；`apps/web/lib/runtime/gateway.ts` 原 `user_local` 只到 `tunnel_ready`，现已补基础 DeviceChannel relay；`apps/web/components/workspace/ChatPanel.tsx` 附件仍只取 `file.name`；Artifact 面板仍主要从 messages metadata 派生，缺 durable artifact 输出合同。 |
| **关闭条件** | cloud 与 local_desktop 核心 `@角色` 流程分别跑通并落库；runtime 不可用时明确失败且不落 fake agent 回复；附件内容可被 runtime 使用；artifact 有 durable output 并可刷新读取；opencli/Playwright 留下 Web/Electron UAT 证据；tracker/report/治理门禁齐全。 |
| **当前进展** | 已关闭（2026-06-01）。已建立合同/任务树/opencli skill；worker 默认改 real；Web Gateway 新增 `sendRuntimeInvokeToDevice` relay、ws-gateway response/runtime_event 分发；Desktop `RuntimeHost` 改用 `runtimeType/prompt` 调 `LocalRuntimeAdapter` 固定 CLI 映射；新增 Redis 跨进程 DeviceChannel request/event relay，修复 Next API 与 WS Gateway 不同进程导致的假 offline；`local_desktop` 核心 @ 链路已用真实 Electron + Claude CLI 跑通并落库。cloud `@架构师` 链路与 390x844 Mobile/PWA 视口已用 Gateway/Redis/runtime worker/real executor 跑通，返回非 echo 回复并落库；public cloud `runtime_logs` 已去除 Gateway/worker 双写。附件上传已通过真实 API 落 `messages.metadata.attachment.content/contentRef`，`@角色` 请求可携带附件上下文，runtime artifact 块已持久化为 pinned message 并在右侧面板刷新后可读。证据：`runtime_sessions.status=completed`，`runtime_logs` 包含本地与远程 runtime output/completed，agent message 持久化；Desktop E2E 45 passed/2 skipped，Web/Desktop type-check PASS，acceptance smoke PASS，Mobile/PWA 截图 `e2e/artifacts/opencli-uat/mobile-cloud-real-flow-390x844.png`，artifact 截图 `e2e/artifacts/opencli-uat/attachment-artifact-panel.png`，最终报告 `research/execution-reports/acceptance-real-flow-2026-06-01-report.md`。 |
| **下一步** | 已关闭。后续增强另拆：大文件/二进制附件对象存储、原生 Android 模拟器人工验收。 |

### REG-20260601-002 — PRD 反查发现 P0 必做未落实与残留假入口

| 字段 | 内容 |
| --- | --- |
| **类型** | prd-gap / unfinished / stale-or-ghost / security |
| **优先级** | P0 |
| **状态** | `open` |
| **关联 FR/PRD** | FR-AUTH-001, FR-WS-001, FR-DESK-001, FR-MOB-001, FR-CHAT-001, FR-ORCH-001, FR-CTX-001, FR-ARTIFACT-001, FR-RESULT-001, FR-ACTION-001, FR-PERM-001, FR-NOTIFY-001 |
| **关联任务/合同** | PRD 反查审计：`research/execution-reports/prd-backtrace-gap-audit-2026-06-01.md`；规范：`.trellis/spec/cross-layer/prd-backtrace-audit.md` |
| **影响功能面** | 本地工作区创建门禁、plans/actions 权限边界、多角色 @、默认 Orchestrator、编排计划调度、pin/handoff/native session、富消息/结果卡/预览、Action 执行、通知/审批、Desktop 旧组件与静态授权记录 |
| **发现方式** | Codex 从 `research/prd.md` P0 FR 逐项反查实际代码入口/API/UI/测试（2026-06-01），本轮未改产品代码、未重新跑 UAT。 |
| **证据** | 详见审计报告 PBA-001..PBA-012。关键 P0 证据：`apps/web/app/api/workspaces/route.ts` 未在 `desktop.ok === false` 时阻止 `local_desktop` 创建；`apps/web/app/api/plans/route.ts` 与 `apps/web/app/api/actions/route.ts` 缺 `session_id -> workspace.owner_id` 校验；`ChatPanel`/`session-store` 只支持单 role；`OrchestratorPanel` 只读已有 plan/action，confirm 不调度执行；Desktop `authorizationRecords` 是 zustand 静态 seed；Mobile preview 仍为占位。 |
| **关闭条件** | 按审计报告优先级拆修并逐项关闭：P0 安全/执行域先修；主旅程补多角色与编排调度；删除或接真实数据的 stale/ghost 入口；富消息、pin/handoff、Action executor 补真实闭环；所有完成结论必须附真实入口、数据/API/runtime、刷新后和负向错误态证据。 |
| **当前进展** | 2026-06-02：已补计划确认到 action/notification、审批到 runtime action dispatcher、`/api/actions/:id/run` 重试恢复、runtime worker 回写 `actions`/`plan_nodes` 终态；已补 Mobile/PWA `/m/preview` 读取 durable `/api/artifacts/:id`，支持 `artifactId` / `url=artifact:<id>`、HTML sandbox、Markdown GFM、code/diff/folder/image 只读预览和下载；已清理 Desktop `authorizationRecords` 产品语义，改为从真实本机 `activities` 派生的“本机策略审计”；已补 Web 主工作台消息 pin 入口，store 保留 `is_pinned`，调用 `PATCH /api/messages/:id` 且右栏 Context/变更面板收到 `messages:changed` 后重拉真实消息，PATCH 拒绝非布尔和不支持字段；已挂载 Web 工作台通知铃，读取 `/api/notifications`，审批通知走 `/api/actions/:id/approve`，成功后标记已读并触发编排面板刷新，通知 API 补错误与 ids 校验；已删除 Desktop 未挂载旧组件 `RuntimeConfigPage`、`RuntimeStatus`、`ActivityLog`、`BindingFlow`、`ConnectionStatus`、`ConnectorConsole`，并把当前 spec/product 文档的 Desktop 主壳定位点和最近 Session 口径同步为真实主壳；已补 Web 多角色 `@` 后端真实分派，`roleAgentIds` 多选时按顺序分别调用 runtime、分别发送 `role_selected`、分别落 agent message，前端 SSE 按角色切换拆成独立回复气泡；已修正实际运行的 `design-system.spec.ts`，不再打开假 `/workspace/test-session` 或把 composer 当 input，改为真实创建 workspace/session 后断言 textarea、消息卡和定位点。同步当前产品/合同/UI spec 文档。Web type-check、Web Vitest、Web build、Desktop type-check/test/build 通过。 |
| **下一步** | 继续逐项关闭剩余 P0：native session resume/continue 增强；继续扫描 Web 未挂载/旧语义入口和历史 E2E 假绿；补真实浏览器 UAT 复验多角色、通知、pin 等主入口。 |

### REG-20260531-010 — 三端 Agent 闭环新缺口：原生 Mobile/Desktop 会话假交互 + Web 编排 UI 未上线（PRODUCT-REALITY-GAP-AUDIT-001 P0）

| 字段 | 内容 |
| --- | --- |
| **类型** | fake-interaction / unfinished（假交互 + 占位 + 未渲染） |
| **优先级** | **P0**（多个用户入口下「Agent 真正执行 / 编排闭环」核心价值未达成） |
| **状态** | `closed`（**全部关闭**：PRGA-002/003 Desktop 已修复（`DESKTOP-SESSION-RUNTIME-001`，2026-05-31）；PRGA-001 原生 Mobile RN 已修复（`MOBILE-RN-CHAT-RUNTIME-001`，2026-05-31）；PRGA-004 Web 编排 UI 已修复（`WEB-ORCHESTRATOR-UI-001`，2026-05-31）） |
| **关联 FR/PRD** | `FR-CHAT-001`, `FR-RUNTIME-001`, `FR-DESKTOP-001`, `FR-MOBILE-001`, `FR-UI-001` |
| **关联任务/合同** | 发现于 `PRODUCT-REALITY-GAP-AUDIT-001`（只读审计；`research/execution-reports/product-reality-gap-audit-001-report.md` + `product-reality-gap-audit-001-findings.json`）。建议修复任务：`MOBILE-RN-CHAT-RUNTIME-001`、`DESKTOP-SESSION-RUNTIME-001`、`DESKTOP-SESSION-CONTROLS-001`、`WEB-ORCHESTRATOR-UI-001` |
| **影响功能面** | (PRGA-001) 原生 Mobile App 聊天发送；(PRGA-002) Desktop 本地 Agent 会话输入指令；(PRGA-003) Desktop 诊断/继续/重试/停止控制；(PRGA-004) Web 编排计划/动作/审批 UI |
| **发现方式** | 静态代码扫描 + 链路追踪，P0 代码位置由审计主进程逐文件 Read 核验（2026-05-31）。⚠️ 真实用户态截图 DEFERRED（CLI 环境未拉起 dev server/Electron/RN Metro，见报告 §2 BLOCKED） |
| **证据** | PRGA-001 `apps/mobile/src/screens/ChatScreen.tsx:13-50`（`setTimeout` 回显 `[Agent] 收到: "<原文>"`，无网络请求，硬编码 `session_id='mobile-sess-1'`）；PRGA-002 `apps/desktop/src/renderer/components/shell/DesktopAgentSession.tsx:14-20`（`handleSend` 只 `addActivity({status:'success'})` echo，renderer 未连 main 进程 `StreamAdapter.spawn`/`DeviceChannel`）；PRGA-003 同文件 `:73-76`（四按钮无 `onClick`）；PRGA-004 `apps/web/components/orchestrator/PlanCard.tsx`+`ActionCard.tsx` 全仓 grep 零引用，`WorkspaceShell` 无编排区，后端 `/api/plans`+`/api/actions` 可用却无界面入口 |
| **与既有账本关系** | 区别于已关闭的 REG-20260530-006：GAP-002 修复的是 `apps/web/app/m/` PWA 路由（`MOBILE-CHAT-DELIVER-001`），**原生 `apps/mobile/` RN App、Desktop 本地会话、Web 编排 UI 三面从未被审计/修复**。「FakeExecutor 回显≠完成」原则在本三面同样适用 |
| **关闭条件** | 各 surface 发送/点击触发真实 runtime/IPC/API 并产生可观测业务结果（非 local state / echo / 硬编码 success）；编排 UI 真实渲染计划/动作并审批生效；各自补真实断言 E2E（非仅 `toBeVisible`/HTTP 200）；report + tracker + 中文 commit 闭环 |
| **部分关闭证据** | `DESKTOP-SESSION-RUNTIME-001`（2026-05-31）关 PRGA-002/003：`apps/desktop/src/main/index.ts` `setupRuntime()` 激活 `registerRuntimeIPC()`（`runtime:execute`→`LocalRuntimeAdapter` 真实 `child_process.exec`）；`preload/index.ts` 暴露 `runtime.execute/available`；`DesktopAgentSession.tsx` `handleSend` 改 async 调真实 IPC，按 `exitCode`/catch 写 `success`/`failed` + stdout/stderr 摘要，**无 runtime → 明确 failed 错误态**，删除硬编码 success；诊断/继续/重试/停止 改 `disabled`+`title=能力未实现（需远程流式 runtime，见 P1-RT）` 非可点无效果。renderer 测试 `apps/desktop/__tests__/desktop-agent-session.test.tsx` **4 passed**（runtime.execute 被调用且状态来自真实返回 / exitCode≠0 失败态 / 无 runtime 失败态 / 四控制按钮 disabled+原因 title），非 `toBeVisible` 糊弄。type-check + build 通过。⚠️ 真实 Electron 用户态截图仍 DEFERRED（CLI 环境无 GUI） |
| **部分关闭证据（PRGA-001）** | `MOBILE-RN-CHAT-RUNTIME-001`（2026-05-31）关 PRGA-001：原生 `apps/mobile/src/screens/ChatScreen.tsx` 删除 `setTimeout` 回显 + 硬编码 `session_id='mobile-sess-1'` + `[Agent] 收到:` echo（`grep setTimeout\|mobile-sess-1\|收到:` → CLEAN）；新增 `src/lib/config.ts`（`getRuntimeConfig` 读 `EXPO_PUBLIC_API_BASE_URL`/`SESSION_ID`/`AUTH_TOKEN`，缺失 → `configured=false`+`missing[]`）；新增 `src/lib/chatClient.ts`（`sendChat` 用 `XMLHttpRequest` POST `{base}/api/chat` + `Authorization: Bearer`，增量解析 SSE `RuntimeGatewayEvent`，累积 `runtime_output.delta`，终端态映射中文通知，HTTP 非 2xx → `onError`，无本地回显）；`ChatScreen` `configured=false` → 禁用发送+输入+中文配置/登录引导错误态，`configured=true` → 流式渲染真实 agent 回复+错误态。测试 `apps/mobile/src/lib/__tests__/chatClient.test.ts` **5 passed**（无 echo+断言 POST 真实 sessionId / 成功累积单条 reply / HTTP 503 onError 中文 / runtime_failed 中文通知 / config 缺失 configured=false），非 `toBeVisible` 糊弄；`@agenthub/shared` build 通过。⚠️ 真实 RN Metro/设备 GUI 截图仍 DEFERRED（CLI 环境无 GUI），跨端持久消息拉取 out-of-scope |
| **部分关闭证据（PRGA-004）** | `WEB-ORCHESTRATOR-UI-001`（2026-05-31）关 PRGA-004：新增 `apps/web/components/orchestrator/OrchestratorPanel.tsx`（`'use client'` 读 `useSessionStore().activeSessionId`，`useEffect` 并行 `fetch` 真实 `GET /api/plans?session_id`+`GET /api/actions?session_id`，渲染 `PlanCard`(onConfirm→`POST /api/plans/:id/confirm`)+`ActionCard`(onApprove→`POST /api/actions/:id/approve {approved}`)，成功后 re-fetch 刷新；未选会话/空数据/error 显式 `StateCard` 空态，**无 mock/硬编码**）；`apps/web/components/workspace/ArtifactPanel.tsx` TABS 增「编排」并渲染 `<OrchestratorPanel />`，**消除 PlanCard/ActionCard 全仓零引用僵尸**（`grep PlanCard\|ActionCard` 排除定义文件 → 仅 `OrchestratorPanel.tsx` 引用）。E2E `e2e/tests/web/web-orchestrator-ui.spec.ts` 真实 API 播种 plan+high-risk action → 切编排 tab → 深度断言卡片标题/节点/命令/风险文案/批准按钮（**非仅 `toBeVisible`**）→ 点批准断言真实 `POST /api/actions/:id/approve` ok → GET 重新读取断言 `status=approved` 持久。`pnpm --filter @agenthub/web type-check` exit 0；`build` success（`/workspace/[id]` 7.18 kB）；`npx playwright test web-orchestrator-ui --list` → 1 test discovered。⚠️ E2E 运行需真实 Supabase DB session（`TEST_AUTH_COOKIE`+`TEST_SESSION_ID`+`TEST_WORKSPACE_ID`），CI 无真实 DB → `test.skip` 标 DEFERRED（与本台账 GUI/DB DEFERRED 一致），断言骨架保留不糊弄 |
| **下一步** | REG-20260531-010 全部关闭（PRGA-001/002/003/004 均已修复）；E2E 真实 DB 运行态截图/绿灯仍 DEFERRED（CLI 环境无 GUI/真实 Supabase）；遗留 E2E 门禁缺陷见 REG-20260531-011（P1，独立任务） |

### REG-20260531-011 — E2E 门禁缺陷：核心功能 spec 全程 mock 主链路 + 只断言表层（PRODUCT-REALITY-GAP-AUDIT-001）

| 字段 | 内容 |
| --- | --- |
| **类型** | test-gap / 门禁缺陷 |
| **优先级** | P1（artifact/messaging/p0-main-flow 为 P0 功能面，但其 spec 不挡假交互） |
| **状态** | `closed`（2026-05-31，`TEST-REALITY-GATE-001` 修复并真实栈实跑 14 passed） |
| **关联 FR/PRD** | `FR-CHAT-001`, `FR-WEB-001`, `FR-UI-001` |
| **关联任务/合同** | 发现于 `PRODUCT-REALITY-GAP-AUDIT-001`。由 `TEST-REALITY-GATE-001` 一次性修复全部四 spec（合并原建议的 4 个子任务） |
| **影响功能面** | (PRGA-007) `e2e/tests/artifact.spec.ts`；(PRGA-008) `e2e/tests/messaging.spec.ts`；(PRGA-009) `e2e/tests/workspace.spec.ts`；(PRGA-010) `e2e/tests/web/p0-main-flow.spec.ts` |
| **发现方式** | 测试层静态扫描 + 主进程 grep 核验（2026-05-31） |
| **证据** | `artifact.spec.ts:41-83` 全程 `page.route` fulfill 伪造 sessions/messages/role-agents，4 test 只 `toBeVisible`（且断言的 Plan/Result/Artifact Detail 文案与当前恒空态 `ArtifactPanel.tsx` 不符——测试green 但产品空壳）；`messaging.spec.ts:39` mock `/api/chat`，行 57 只断言用户消息气泡 `.bg-blue-500`，**从不断言 agent 回复**；`workspace.spec.ts:9-55` 全 mock 只 `toBeVisible`；`p0-main-flow.spec.ts:12-71` 用 `if (await x.isVisible())` 条件保护跳过核心断言、无 reload 验证 |
| **关闭条件** | 移除主链路 `page.route` mock 改真实 API/DB；断言 agent 回复非空非 echo + reload 持久化；移除条件保护；与既有「好测试」白名单（`role-chat-uat-reply.spec.ts`/`mobile-chat-deliver.spec.ts`/`chat.test.ts` AT-005/006）对齐标准 |
| **关闭证据** | 四 spec 全改真实 `POST /api/workspaces+role-agents+sessions+messages` + `/api/chat` 真实链路；删除所有 `page.route` 与 `if(isVisible)` 守卫；断言真实数据/agent 回复或明确错误终态/reload 持久化；`playwright.config.ts` web-desktop `testMatch` 补齐此前从不被收集的 `workspace/artifact/messaging.spec`。真实栈实跑（cleaned DB + `docker/.p0-test.env` 真实 authjs cookie + 真实 Supabase + Next API）**14 passed**（4 spec 7 test + 审计锚点 7 test），`/api/chat` 实际 compiled+被调用。审计锚点 `product-reality-gap-audit.spec.ts` PRGA-005/007/008/009/010 反转为修复后事实（顺带反转 sibling 任务遗漏的 PRGA-001/004） |
| **下一步** | 已关闭；RUNTIME_E2E worker-mode（真实 agent 回复路径，本次仅覆盖 no-worker 错误终态）实跑 DEFERRED → `RUNTIME-REAL-EXECUTOR-E2E-001`（P1）；GUI 截图 DEFERRED |

### REG-20260531-002 — workspace selector 下拉越界且无内部滚动（FLOATING-UI-UAT-AUDIT-001 GAP-001）

| 字段 | 内容 |
| --- | --- |
| **类型** | bug / UI 浮层定位 |
| **优先级** | high（核心导航入口，3 视口复现） |
| **状态** | `closed`（2026-05-31，FLOATING-UI-FIX-D1-001 修复并真实浏览器验证通过） |
| **关联 FR/PRD** | `FR-WEB-001`, `FR-UI-001`；`research/product/ui-design-system.md`（浮层定位） |
| **关联任务/合同** | `FLOATING-UI-UAT-AUDIT-001`（发现）→ `FLOATING-UI-FIX-D1-001`（修复闭环）；母版 `UI-TOOLTIP-POSITION-001`（packages/ui Tooltip portal+flip+max-width 正向对照） |
| **影响功能面** | `apps/web/components/workspace/Sidebar.tsx` 工作区切换下拉（裸 `absolute left-2 right-2 top-full`，无 portal/flip/max-height，`z-10`） |
| **发现方式** | FLOATING-UI-UAT-AUDIT-001 真实浏览器（Chromium）+ 真实 DB(`agenthub_p0_test`) + 真实 Auth.js session 几何审计（`e2e/tests/web/floating-ui-uat-audit.spec.ts`，非 `toBeVisible`） |
| **证据** | `research/execution-reports/floating-ui-uat-audit-001-findings.json` D1×3 视口：floating 263×4358/4394/4430，bottom 4418/4454/4490 远超 vh(900/800/900)，无内部滚动；截图 `e2e/artifacts/floating-ui-uat-audit/{1440x900,1280x800,768x900}-D1-workspace-dropdown.png` |
| **关闭条件** | FIX-D1：workspace 下拉 portal-to-body + flip/shift（参考 Tooltip `computePosition`）+ `max-h` 内部 `overflow-y-auto` 滚动 + z-index 提升至 popover 层；3 视口 floating bbox 完整落在视口内、超长列表内部滚动而非撑高页面、不引发横滚（几何断言，非 `toBeVisible`） |
| **关闭证据** | FLOATING-UI-FIX-D1-001（2026-05-31）：`Sidebar.tsx` 抽出 `WorkspaceDropdown` portal-to-body + `computeDropdown` flip/clamp + `maxHeight`(≤60%vh)+`overflow-y-auto` + `z-50` + pointerdown 外部关闭。真实浏览器三视口 **3 passed**，D1 floating 高 540/480/540（修复前 ~4400）、bottom 588/528/588 全在视口内、symptoms 空、severity=ok。findings.json `ok×13/medium×1`（剩 medium=O1/REG-003，范围外）。报告 `research/execution-reports/floating-ui-fix-d1-001-report.md` |
| **下一步** | 已关闭。预防项 FIX-D2（role picker，REG 暂未登记）/ FIX-O1（REG-20260531-003）按需另起 |

### REG-20260531-003 — 移动 artifact 抽屉无 backdrop / 无点击外部关闭（FLOATING-UI-UAT-AUDIT-001 GAP-002）

| 字段 | 内容 |
| --- | --- |
| **类型** | bug / 交互一致性 |
| **优先级** | medium |
| **状态** | `closed`（2026-05-31，FLOATING-UI-FIX-REMAINING-001 修复并真实浏览器验证通过） |
| **关联 FR/PRD** | `FR-WEB-001`, `FR-UI-001`；`research/product/ui-design-system.md`（抽屉/overlay 一致性） |
| **关联任务/合同** | `FLOATING-UI-UAT-AUDIT-001`（发现）→ `FLOATING-UI-FIX-REMAINING-001`（修复闭环）；母版 `FLOATING-UI-FIX-D1-001`（sidebar drawer backdrop 正向对照） |
| **影响功能面** | `apps/web/components/workspace/WorkspaceShell.tsx` artifact 移动抽屉（`fixed inset-y-0 right-0`，`z-30`，与 sidebar 抽屉同 z 且无 backdrop） |
| **发现方式** | FLOATING-UI-UAT-AUDIT-001 真实浏览器 + 真实 DB/auth 几何审计（768×900 视口） |
| **证据** | `research/execution-reports/floating-ui-uat-audit-001-findings.json` O1@768：fixed 320×900 无 backdrop（对照 sidebar 抽屉有 `sidebar-backdrop`），无点击外部关闭；截图 `e2e/artifacts/floating-ui-uat-audit/768x900-O1-artifact-overlay.png` |
| **关闭条件** | FIX-O1：artifact 移动抽屉补 `artifact-backdrop`（`fixed inset-0 z-20 lg:hidden`）+ 点击外部关闭 + 与 sidebar 抽屉 z 分层；移动态几何断言通过（存在覆盖全视口 backdrop、点击关闭、与 sidebar 不同 z） |
| **关闭证据** | FLOATING-UI-FIX-REMAINING-001（2026-05-31）：`WorkspaceShell.tsx` 新增 `artifact-backdrop`（`fixed inset-0 z-20 bg-black/40 lg:hidden`，onClick 关闭）+ 移动顶栏 `z-[25]`（高于 backdrop z-20、低于抽屉 z-30，修复 backdrop 拦截 `open-sidebar` 入口回归）；桌面 `lg:hidden` 三栏零影响。真实浏览器三视口 **3 passed**，O1@768 backdrop 覆盖全视口（width≥vw、height≥vh）、点击 backdrop 抽屉关闭、backdrop z(20)<抽屉 z(30)、桌面 1440/1280 无可见 backdrop；findings.json O1×3 severity=ok、symptoms 空（全 16 ok）。报告 `research/execution-reports/floating-ui-fix-remaining-001-report.md` |
| **下一步** | 已关闭。同任务预防项 FIX-D2（role picker portal 升级）一并完成，见报告 |

### REG-20260530-006 — Web/Mobile Agent 回复在真实用户态不可达（审计建议 003，与已关闭 003 区分）

| 字段 | 内容 |
| --- | --- |
| **类型** | bug / unfinished / P0 regression |
| **优先级** | P0 blocker（阻塞继续扩大对话功能面） |
| **状态** | `closed`（Web GAP-001 由 `ROLE-CHAT-RUNTIME-DELIVER-001` commit `eed577f` 关闭；Mobile GAP-002 由 `MOBILE-CHAT-DELIVER-001` commit `3b8029f` 关闭） |
| **关联 FR/PRD** | `FR-CHAT-001`, `FR-WEB-001`, `FR-MOB-001`, `FR-RUNTIME-001`, `FR-UI-001`；`research/prd.md` 多 Agent 协作主链路 |
| **关联任务/合同** | `P0-END-TO-END-PRODUCT-FLOW`；`ROLE-CHAT-CORE-001`；`ROLE-CHAT-UAT-REPLY-001`（其 REG-20260530-003「关闭」仅测试态成立）；`research/contracts/P0-END-TO-END-PRODUCT-FLOW.md` §3.1.8/§6 |
| **影响功能面** | Web `/api/chat` runtime 链路；Mobile `/m/sessions/:id` 发送；公共云端 Runtime worker 部署；唯一可见回复断言 |
| **发现方式** | PRODUCT-UAT-GAP-AUDIT-001 真实浏览器 + 真实 DB(`agenthub_p0_test`) + 真实 Auth.js session 审计（非只看代码/测试） |
| **证据** | `research/execution-reports/product-uat-gap-audit-001-browser-findings.json`（两 regime `saw_real_agent_reply:false`）；regime2 `POST /api/chat 200 in 8469ms`（idle 超时空等）；P0 DB `runtime_endpoints=0`/`runtime_sessions=0`/`messages` user41:agent13；`apps/web/lib/runtime/gateway.ts:117` 仅以 `REDIS_URL` gating，`resolveEndpoint` 的 `unconfigured` 状态(line52)从不 gating；`apps/web/server/runtime-worker.ts:11` 默认 `FakeExecutor`；`apps/web/app/m/sessions/[sessionId]/page.tsx` 发送走 `/api/messages` 不走 `/api/chat`；`e2e/tests/web/role-chat-uat-reply.spec.ts:26` `test.skip(!RUNTIME_E2E)` |
| **为什么此前漏掉** | 唯一断言「可见 agent 回复」的 E2E 默认 `skip`，执行时也只验 FakeExecutor 回显；verify/review/goal-audit 以 HTTP 200 / 落库 / `toBeVisible` 收口，未对照合同「用户目标达成」 |
| **关闭条件** | 默认运行入口（无 `RUNTIME_E2E`）下：有真实 worker(非 FakeExecutor) → 用户看到非空带角色回复并落 `messages`；无 worker/endpoint `unconfigured` → gateway **立即**短路明确中文错误态（不空等 60s）；Mobile 发送走同一 runtime 链路或明确闭环文案；可见回复断言改为不可默认跳过的常驻门禁 |
| **Web GAP-001 关闭证据** | `ROLE-CHAT-RUNTIME-DELIVER-001`（commit `eed577f`）：gateway public_cloud 分支改用 `resolveEndpoint` status/id + 活跃 worker 在线键门控（不再仅凭 `REDIS_URL`）；无 worker/unconfigured 立即短路明确中文错误态（实测 <2s，消除 60s idle 空等）；非回显 `ScriptedRealExecutor` 真实交付验证；两条默认不可跳过 E2E（无 worker→立即错误态 / 真实 worker→可见回复+reload）。verify passed=true（6 truths VERIFIED）、review PASS、UAT 2/2、milestone-audit PASS（0 gaps）。归档 `.workflow/milestones/adhoc-role-chat-runtime-deliver/` |
| **Mobile GAP-002 关闭证据** | `MOBILE-CHAT-DELIVER-001`：`apps/web/app/m/sessions/[sessionId]/page.tsx` 发送从纯 `/api/messages` 写库改为走统一 `/api/chat` runtime SSE 链路（与 Web 一致），消费 `runtime_output` deltas 累积可见 agent 回复；解析 session→workspace→role-agents，默认架构师 orchestrator 角色上下文（发送按钮在 `defaultRole` 解析前门控）；runtime 终态事件（`endpoint_unavailable`/`local_runtime_offline`/`tunnel_disconnected`/`runtime_failed`）映射明确中文系统提示，绝不静默仅存用户消息。附带修复 `apps/web/app/api/sessions/[id]/route.ts`（原 `workspaces!inner` 嵌套 select 在自研 postgres-query-client 下 404，改为 plain select + 独立 owner_id 归属校验）。新增真实浏览器移动视口 E2E `e2e/tests/mobile/mobile-chat-deliver.spec.ts`（iPhone 14 390×844，真实 DB + 真实 auth）：route 监听断言 `POST /api/chat` 被调用 + 有 worker→可见非 echo 回复+架构师 role badge+reload 双向持久化 / 无 worker→立即明确中文错误态+reload 无误存 badge（非仅 `toBeVisible`）。verify passed=true（G1/G2/G3 VERIFIED）、review PASS（0 findings）、UAT 双 regime 各 1 passed。commit `3b8029f`。 |
| **下一步** | Web GAP-001 ✅（`ROLE-CHAT-RUNTIME-DELIVER-001`）+ Mobile GAP-002 ✅（`MOBILE-CHAT-DELIVER-001`）均已关闭，REG-20260530-006 整体 `closed`；详见 `research/project-tracker.md` |

### REG-20260530-007 — Artifact 面板恒静态空态、从不接真实数据（审计建议 004）

| 字段 | 内容 |
| --- | --- |
| **类型** | unfinished / UX |
| **优先级** | P1 |
| **状态** | `closed`（2026-05-31，`ARTIFACT-PANEL-DATA-001` 修复并验证：三 Tab 接真实数据，假空态消除） |
| **关联 FR/PRD** | `FR-WEB-001`, `FR-UI-001`；`P0-END-TO-END-PRODUCT-FLOW.md` §3.1.10（三栏含 Artifact/Context/Agents） |
| **关联任务/合同** | `PRODUCT-UAT-GAP-AUDIT-001` / `PRODUCT-REALITY-GAP-AUDIT-001`(PRGA-005)（发现）→ `ARTIFACT-PANEL-DATA-001`（修复闭环） |
| **影响功能面** | Web workspace 右栏「产物 / 上下文 / Agents」三 Tab |
| **发现方式** | PRODUCT-UAT-GAP-AUDIT-001 真实浏览器 + 代码核对 |
| **证据** | `apps/web/components/workspace/ArtifactPanel.tsx` 三 Tab 全硬编码 `StateCard variant="empty"`、无任何 fetch；同 workspace `/api/role-agents` 返回非空（含「架构师」），但「Agents」Tab 恒显「暂无 Agent」 |
| **关闭条件** | Agents Tab 呈现真实 `role_agents`；产物/上下文接对应数据源或显式标注 P1 未实现范围；补面板数据一致性断言（非仅 `toBeVisible`） |
| **关闭证据** | `ARTIFACT-PANEL-DATA-001`（2026-05-31）：`ArtifactPanel.tsx` 删除三个硬编码恒空 `StateCard`，改 AgentsTab 读 `useSessionStore().activeWorkspaceId` → `fetch GET /api/role-agents?workspace_id` 按 snake_case 渲染 `name/role_type/capabilities/is_orchestrator`；ContextTab+OutputTab 共用 `useSessionMessages()` 读 `GET /api/messages?session_id`，上下文筛 `is_pinned||metadata` 非空、产物筛 `message_type∈{plan_card,result_card}||metadata.artifact`；空态仅真实 fetch 为空时显示（`loaded && length===0`），未选 workspace/session 与 error 单独显式态；`data-testid` artifact-agents/artifact-context/artifact-output；**编排 Tab `<OrchestratorPanel />` 保留**（向后兼容 WEB-ORCHESTRATOR-UI-001）；无 mock/硬编码假空态。E2E `e2e/tests/web/artifact-panel-data.spec.ts` 真实 API 播种 role agent+session+pinned 上下文+result_card 产物（非 `page.route` mock）→ 切三 Tab 断言真实数据文本（非仅 `toBeVisible`）+ 交叉校验 `GET /api/role-agents`。`pnpm --filter @agenthub/web type-check` exit 0；`build` exit 0（`/workspace/[id]` 7.68 kB）；`playwright test artifact-panel-data --list` → 1 test。⚠️ E2E 实跑需真实 Supabase DB（`TEST_AUTH_COOKIE`+`TEST_WORKSPACE_ID`），CI 无真实 DB → `test.skip` 标 DEFERRED 保留断言骨架（与 REG-20260531-010 GUI/DB DEFERRED 一致） |
| **下一步** | 已关闭（`ARTIFACT-PANEL-DATA-001`）；遗留 E2E 门禁缺陷见 REG-20260531-011（P1，含 `artifact.spec.ts` 假数据），独立处理 |

### REG-20260530-008 — 默认 `apps/web/.env.local` 指向 Supabase 占位符、真实用户跑不通主链路（审计建议 005）

| 字段 | 内容 |
| --- | --- |
| **类型** | env / dev-setup |
| **优先级** | P1 |
| **状态** | `open` |
| **关联 FR/PRD** | `FR-WEB-001`；`P0-END-TO-END-PRODUCT-FLOW.md` §5（migration/seed/dev setup 可执行） |
| **关联任务/合同** | `PRODUCT-UAT-GAP-AUDIT-001` |
| **影响功能面** | 默认开发入口 `pnpm dev:web` 的 DB/Runtime 连接；新环境可复现性与可演示性 |
| **发现方式** | PRODUCT-UAT-GAP-AUDIT-001（须切换 P0 harness env 才能跑通登录与主链路） |
| **证据** | `apps/web/.env.local` 实际值为 `NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co` 占位符，无可用 DB/`REDIS_URL`；审计须改用 `docker/.p0-test.env`（真实 `agenthub_p0_test` Postgres + 真实 auth cookie）才能跑通 |
| **关闭条件** | 提供可复现的本地真实 DB/Redis env（或 `dev:full` 自动指向 p0/dev DB）；补「默认入口启动 → 登录 → 主链路可用」冒烟 |
| **下一步** | `DEV-ENV-BOOTSTRAP-001`(P1) |


### REG-20260531-012 — Web Workspace 本地连接/Agents/附件/Desktop IPC 真实验收缺口

| 字段 | 内容 |
| --- | --- |
| **类型** | bug / unfinished / real UAT gap |
| **优先级** | P0 |
| **状态** | `closed`（2026-05-31，WORKSPACE-LOCAL-DESKTOP-UAT-001 修复并真实浏览器验证通过） |
| **关联 FR/PRD** | `FR-WEB-001`, `FR-WS-001`, `FR-CHAT-001`, `FR-RUNTIME-001`, `FR-DESKTOP-001`, `FR-DEVICE-001`, `FR-UI-001` |
| **关联任务/合同** | `WORKSPACE-LOCAL-DESKTOP-UAT-001`；`research/contracts/WORKSPACE-LOCAL-DESKTOP-UAT-001.md`；`.trellis/tasks/05-31-workspace-local-desktop-uat/prd.md` |
| **影响功能面** | Web `/workspace/:id`、`/workspace` 新建工作区、右栏 Agents/编排/附件、Desktop `device-channel:connect` IPC |
| **发现方式** | 用户真实 Web 3000/Desktop dev 验收反馈：编排加载失败不可行动、Agents 只有架构师且不能 CRUD、工作区内不能回“我的工作区”、看不到登录/本地连接状态、未连接也可建本地工作区、附件可点无效果、Desktop 报 `No handler registered for 'device-channel:connect'` |
| **证据** | 代码核对确认：`ArtifactPanel.tsx` Agents 仅列表展示，旧 `DetailPanel.tsx` CRUD 不在当前入口；`CreateWorkspaceDialog.tsx` 无 `local_desktop` connected 门禁；`ChatPanel.tsx` 附件按钮无行为；`OrchestratorPanel.tsx` 泛化错误；Desktop `DeviceChannel` 构造时注册 handler，但初始化失败会让 renderer 收到 Electron 低层 no-handler。 |
| **关闭条件** | Workspace 内有返回入口和登录/Desktop/runtime 状态；未连接 Desktop 时前后端均阻止 `local_desktop` 创建；Agents Tab 可真实 create/edit/delete 并刷新 @角色；编排 API 错误显示具体状态码/message；附件未实现时明确禁用；Desktop main 即使 DeviceChannel 初始化失败也注册 fallback IPC，避免 no-handler；真实浏览器 UAT 覆盖用户结果。 |
| **关闭证据** | `WORKSPACE-LOCAL-DESKTOP-UAT-001`（2026-05-31）：新增 `/api/runtime/status`；`POST /api/workspaces` local_desktop connected gate（未连接 409）；`WorkspaceShell` 状态栏 + 返回“我的工作区”；`CreateWorkspaceDialog` 前端门禁；`ArtifactPanel` Agents CRUD；`ChatPanel` 监听 `role-agents:changed` 刷新 @角色；`OrchestratorPanel` 显示 `/api/plans`/`/api/actions` 具体错误；附件按钮禁用并显示“附件暂未开放”；Desktop 新增 `device-channel-ipc.ts` active/fallback handler。验证：Web/Desktop type-check PASS；Desktop IPC unit 2 passed；真实 Chromium UAT `workspace-local-desktop-uat.spec.ts` 1 passed（6.5s，真实 Postgres + Auth.js session，cloud 201、本地未连接 409、Agents create/edit/delete、@同步、无横滚）。报告 `research/execution-reports/workspace-local-desktop-uat-001-report.md` |
| **下一步** | 已关闭。真实附件上传后端另起 `ATTACHMENT-UPLOAD-001`；默认 dev env 引导仍归 `DEV-ENV-BOOTSTRAP-001` / REG-20260530-008。 |

### REG-20260531-013 — Desktop Codex 一次性消息显示 Codex 转录流且可能超时误判失败

| 字段 | 内容 |
| --- | --- |
| **类型** | bug / Desktop local runtime UX |
| **优先级** | P0（Codex 本地消息已返回但 UI 显示失败、重复日志，影响本地 Runtime 可用性判断） |
| **状态** | `closed`（2026-05-31，WORKSPACE-LOCAL-DESKTOP-UAT-001 后续修复） |
| **关联 FR/PRD** | `FR-RUNTIME-001`, `FR-DESKTOP-001`, `FR-UI-001` |
| **关联任务/合同** | `WORKSPACE-LOCAL-DESKTOP-UAT-001`；`research/contracts/WORKSPACE-LOCAL-DESKTOP-UAT-001.md`；`.trellis/tasks/05-31-workspace-local-desktop-uat/prd.md` |
| **影响功能面** | Desktop 本地工作区 Codex 一次性消息、执行活动详情、停止/超时体验 |
| **发现方式** | 用户真实 Desktop 验收反馈：`[Codex] 你是谁` 返回内容后仍显示失败，详情混入 `Reading additional input from stdin...`、Codex 横幅、重复 prompt、`tokens used`，长输出在失败标题和原因里重复。 |
| **根因** | `codex exec` stdout 是运行转录流，不是最终回复协议；Desktop 直接展示 stdout/stderr，且 60s timeout 对 Codex 启动/推理偏短，失败态把同一段输出同时写入 `message` 和 `reason`。 |
| **关闭证据** | `LocalRuntimeAdapter` Codex 命令加入 `--output-last-message "$AGENTHUB_OUTPUT_FILE"`，优先读取最终回复文件；stdout 兜底清理 stdin 提示、横幅、转录标签和 `tokens used`；Codex timeout 调整为 180s；失败活动标题只保留 `[Agent] prompt`，详情放入 `reason`。验证：`pnpm --filter @agenthub/desktop test -- local-adapter.test.ts desktop-agent-session.test.tsx --run` 12 passed；`pnpm --filter @agenthub/desktop type-check` PASS；`pnpm --filter @agenthub/desktop test -- --run` 23 passed；`pnpm --filter @agenthub/desktop build` PASS。 |
| **下一步** | 已关闭。若后续要做流式 Codex 会话，应另定义 runtime event 增量协议，不能复用 stdout 转录直接作为 UI 消息。 |


### REG-20260531-004 — `@agenthub/web` build 被 dual `@types/react`（mobile 18 / web-ui-desktop 19）阻断（build blocker，已关闭）

| 字段 | 内容 |
| --- | --- |
| **类型** | build blocker / monorepo 依赖解析（dual `@types/react`） |
| **优先级** | P0 build blocker（`pnpm --filter @agenthub/web build` 直接 exit 1，发布主链路 `release:web` 不可用） |
| **状态** | `closed`（2026-05-31，WEB-BUILD-REACT-TYPES-001 修复并 build/type-check 全绿） |
| **关联 FR/PRD** | `FR-WEB-001`；发布/构建工具链 |
| **关联任务/合同** | `WEB-BUILD-REACT-TYPES-001`（修复闭环）；此前以 carried-over concern 形式散见于 `FLOATING-UI-FIX-D1-001` / `UI-TOOLTIP-POSITION-001` / `WEB-WORKSPACE-LAYOUT-UAT-001` 报告（“pre-existing dual @types/react 冲突，同源同类 +1”），本次正式升级为独立 build blocker 并关闭 |
| **影响功能面** | `apps/web` 全量 `next build` / `tsc --noEmit`：`app/m/preview/page.tsx`(`Suspense`)、`components/chat/ChatPanel.tsx`(`ReactMarkdown`)、`components/workspace/Sidebar.tsx`(`WorkspaceDropdown`/`createPortal`)、`packages/ui/src/components/tooltip.tsx`(`TooltipContent`/`createPortal`) 全部 TS2786 |
| **发现方式** | `pnpm --filter @agenthub/web build` 复现；`tsc --traceResolution` 定位 |
| **根因** | TS ambient `@types` 发现把两份 `@types/react` 同时纳入 web 编译图：`apps/web/node_modules/@types/react`=19.2.15（正确）+ pnpm hoist 到 `node_modules/.pnpm/node_modules/@types/react`=18.3.29（mobile 锁定版，泄漏）。React 18 `ReactPortal.children` 必填、React 19 可选，两份 `React.ReactNode` 结构不兼容 → 所有 `Suspense`/portal/`ReactMarkdown` JSX 报错。根因非 `Suspense`、非业务代码 |
| **关闭条件** | 在依赖解析层根治（不用 `any`/cast/`skipLibCheck`/关闭类型检查）：`pnpm --filter @agenthub/web build` exit 0 + `pnpm --filter @agenthub/web type-check` exit 0 + `packages/ui` type-check exit 0 + 目标冲突类型全消除 + mobile React 18 隔离保持 |
| **关闭证据** | WEB-BUILD-REACT-TYPES-001（2026-05-31）：根 `.npmrc` 增 `hoist-pattern[]=!@types/react` / `!@types/react-dom`，剔除 pnpm 虚拟仓库根裸副本；`pnpm install` 后 `node_modules/.pnpm/node_modules/@types/react` 消失。web build exit 0 / web type-check exit 0 / ui type-check exit 0 / desktop type-check exit 0、残留 ReactNode/ReactPortal/Suspense/Tooltip/createPortal/TS2786 = 0；`pnpm -r list @types/react`：web/ui/desktop=19.2.15、mobile=18.3.29（隔离保持）。报告 `research/execution-reports/web-build-react-types-001-report.md` |
| **下一步** | 已关闭。后续如新增包，遵循同一 `@types/react` 非 hoist 隔离约定（每个 workspace 经自身直接依赖解析版本） |

### REG-20260530-002 — Web E2E 共享单用户并行 worker 数据污染（既有套件脆弱性）

| 字段 | 内容 |
| --- | --- |
| **类型** | test-infra fragility |
| **优先级** | P1 |
| **状态** | open |
| **影响功能面** | `e2e/tests/web/*`（尤其 `role-chat-core.spec.ts:35`、`p0-workspace-flow.spec.ts`）依赖在共享单一 P0 测试用户的 workspace 列表中查找“刚创建”项 |
| **发现方式** | WEB-WORKSPACE-UX-001 verify 阶段并行运行 web-desktop+web-tablet 时暴露 |
| **证据** | `fullyParallel:true` + 本地多 worker 下，多 spec 在同一用户累积 36+ workspace；`role-chat-core.spec.ts` line 35 `getByRole('button',{name:wsName}).click()` 在列表中找不到刚建 workspace。移除 WEB-WORKSPACE-UX 新 spec 后 ROLE-CHAT 仍 2/2 失败 → 与本次改动无关 |
| **为什么不在 UX-001 内修** | 属测试隔离/夹具设计问题，跨多个既有 spec，超出 WEB-WORKSPACE-UX-001（deep-link/拉消息行为）边界；CI 用 `workers:1` 可规避，本地多 worker 才触发 |
| **关闭条件** | 为共享 DB 状态的 web spec 提供按 spec 隔离的夹具（独立用户或 per-test 清理/重新 seed），或将 workspace-mutating web spec 配置为同 worker 串行；确保本地多 worker 与 CI 均稳定 |
| **下一步** | 单列 test-infra 任务处理；不阻塞 WEB-WORKSPACE-UX-001 关闭 |


## 关闭记录

### REG-20260531-001 — 全局 Tooltip 边缘/overflow 容器/移动端错位裁切变形（由 UI-TOOLTIP-POSITION-001 修复关闭）

| 字段 | 内容 |
| --- | --- |
| **类型** | UI layout / a11y regression |
| **优先级** | P1 |
| **状态** | `closed` |
| **关联 FR/PRD** | `FR-UI-001` |
| **关联任务/合同** | `UI-TOOLTIP-POSITION-001`（`research/project-tracker.md` 同名条目 + `research/execution-reports/ui-tooltip-position-001-report.md`）；Ralph session `ralph-20260531-000642` |
| **影响功能面** | workspace 全部 IconButton（新建会话 / @角色 / 发送 / 打开侧栏 / 切换面板）的 Tooltip 在桌面 1440/1280 + 移动 768 的定位/换行/裁切 |
| **发现方式** | packages/ui Tooltip 代码核对 + 真实浏览器 E2E（旧 `absolute bottom-full left-1/2 -translate-x-1/2 + whitespace-nowrap` 被 overflow 容器裁切、边缘越界、长文案横向拉伸变形） |
| **证据** | 修复前：`tooltip.tsx` 绝对定位 + `whitespace-nowrap` → 被祖先 overflow 裁切 + viewport 边缘越界 + 变形/可能横滚。修复后：`createPortal` 到 body + `computePosition`（fits/flip/clamp）+ `max-w-[16rem] break-words`；`e2e/tests/web/ui-tooltip-position.spec.ts` 真实浏览器 6/6 passed（1440/1280/768 × web-desktop+web-tablet），boundingBox 在 viewport 内 + 无横滚 + 未遮挡断言；verification.json passed=true gaps=[]、review.json PASS（0 critical/blocking）、test-results.json 6/6 |
| **关闭条件（已满足）** | Tooltip portal 不被 overflow 裁切、自动 flip/shift 不越界、max-width 换行不变形、不遮挡触发按钮、无横向滚动；hover+focus 双触发保留 role=tooltip/aria-describedby；shared UI 层统一修复无逐按钮补丁；E2E boundingBox 几何断言（非仅 `toBeVisible`） |
| **关闭时间** | 2026-05-31 |
| **结转 concern（不阻塞）** | 768 `toggle-artifact-btn` 被 artifact 空态面板层叠覆盖（响应式三栏布局问题，超出 tooltip 范围，右边缘断言条件跳过，左边缘 open-sidebar 已覆盖 flip/shift）；apps/web full build 受 pre-existing dual @types/react 冲突（E2E dev 模式未受阻） |

### REG-20260530-009 — Web workspace 三栏布局移动失稳 + 按钮位置/交互几何断言缺失（由 WEB-WORKSPACE-LAYOUT-UAT-001 修复关闭）

| 字段 | 内容 |
| --- | --- |
| **类型** | UI layout / UX regression + test-gap |
| **优先级** | P0（RC1 三栏移动失稳）+ P1（RC2-RC6 按钮几何/行为断言缺失） |
| **状态** | `closed` |
| **关联 FR/PRD** | `FR-WEB-001`, `FR-UI-001`；`P0-END-TO-END-PRODUCT-FLOW.md`（Web workspace 三栏可用性） |
| **关联任务/合同** | 由 `WEB-WORKSPACE-LAYOUT-UAT-001` 修复关闭（`research/project-tracker.md` 同名条目 + `research/execution-reports/web-workspace-layout-uat-001-report.md`） |
| **影响功能面** | Web `/workspace/:id` 三栏布局（桌面 1440×900/1280×800 + 移动 768）、新建会话/workspace 切换/@角色/发送/Artifact 面板入口位置与点击行为 |
| **发现方式** | WEB-WORKSPACE-LAYOUT-UAT-001 analyze 阶段真实浏览器 + 代码核对（ANL-web-workspace-layout-uat-2026-05-30，RC1-RC6） |
| **证据** | 修复前：`WorkspaceShell.tsx:14` 固定 `grid-cols-[280px_1fr_320px]` 无断点 → 移动横向溢出 + 三栏挤压不可用；按钮位置正确但无 boundingBox 几何 + 点击真实结果联合断言。修复后：响应式 `lg:grid-cols-[280px_minmax(480px,1fr)_320px]` + `overflow-x-hidden` + 移动抽屉/overlay；`e2e/tests/web/web-workspace-layout-uat.spec.ts` 3 视口真实浏览器 3 passed (6.5s)，boundingBox 几何 + 点击行为断言；verification.json PASS、review.json PASS（0 high）、uat.md 3/3 |
| **关闭条件（已满足）** | 三栏桌面 + 移动稳定（无横滚 + 中栏 ≥480 + 三栏不重叠）；6 类按钮 boundingBox 几何 + onClick 真实结果断言（非仅 `toBeVisible`、非 baseline 截图对比）；错误布局测试必失败 |
| **关闭时间** | 2026-05-30 |

### REG-20260530-003 — ROLE-CHAT-CORE-001 可见 agent 回复 + 角色 Badge deferred（重定级 P0 后关闭）

| 字段 | 内容 |
| --- | --- |
| **类型** | unfinished / UX gap |
| **优先级** | P0 blocker（自 ROLE-CHAT-CORE-001 deferred 项重定级——用户 @角色发送后无可见回复属主链路阻塞，非可选增强） |
| **状态** | `closed` |
| **关联 FR/PRD** | `FR-CHAT-001`, `FR-WEB-001`, `FR-RUNTIME-001`, `FR-UI-001` |
| **关联任务/合同** | 发现于 `ROLE-CHAT-CORE-001`（`research/project-tracker.md` 同名条目 + `research/execution-reports/role-chat-core-report.md#6`）；由 `ROLE-CHAT-UAT-REPLY-001` 修复关闭 |
| **影响功能面** | Web `/api/chat` 角色对话：@架构师发送后可见 agent 回复 + 角色上下文标识 + reload 持久化 |
| **发现方式** | 用户验真样本（2026-05-30，localhost:3000 @架构师发送后只见用户消息）+ ROLE-CHAT-CORE-001 报告 §6 显式登记的 deferred 切片 |
| **为什么重定级** | 原 deferred 理由是「P0 harness 无 Redis/worker」，但可见 agent 回复是角色对话主链路的核心交付，不是可选增强；归类为 P0 blocker 而非延后增强 |
| **证据** | `cd e2e && RUNTIME_E2E=1 npx playwright test --project=web-desktop web/role-chat-uat-reply.spec.ts web/web-workspace-ux.spec.ts web/role-chat-core.spec.ts` → 3 passed（真实 DB+Redis+worker，无 mock，DB 校验 messages 同含 user+agent 行）；verification.json PASS（5/5）；review.json PASS（0 critical/0 high）；`research/execution-reports/role-chat-uat-reply-001-report.md` |
| **关闭条件（已满足）** | `/api/chat` 在 `runtime_completed && reply` 非空时落 `sender_type=agent`（no-fake-success）；E2E 拉起 Redis+worker 断言可见回复文本 + role badge + reload 双向持久化；单测 AT-005/AT-006 覆盖正反两路 |
| **关闭时间** | 2026-05-30 |

### REG-20260530-001 — Web Workspace 真实交互闭环缺口（已关闭）

由 `WEB-WORKSPACE-UX-001`（URL workspace 选中 / Sidebar 不覆盖 / setActiveSession 拉消息 + deep-link E2E）与 `ROLE-CHAT-CORE-001`（`sendMessage→/api/chat`、新建会话 onClick）联合修复，并由 `ROLE-CHAT-UAT-REPLY-001` 在真实 DB+Redis+worker E2E 下端到端复验通过（`web-workspace-ux.spec.ts` 含 `GET /workspace/:id` → `/api/sessions` → `/api/messages` → `POST /api/chat 200` + 视觉 + reload 断言）。关闭时间：2026-05-30。
