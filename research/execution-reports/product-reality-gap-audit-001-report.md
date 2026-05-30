# PRODUCT-REALITY-GAP-AUDIT-001 — 三端假交互/占位/未闭环审计报告

- **审计 ID**：PRODUCT-REALITY-GAP-AUDIT-001
- **日期**：2026-05-31
- **类型**：产品现实差距审计（假交互 / 占位功能 / 技术链路通过但用户目标未达成）
- **模式**：只读审计，不修复产品代码
- **判定基准**：从真实业务需求与用户目标出发。**不**把「按钮可见 / 状态变化 / local store 变化 / 日志新增 / HTTP 200 / 用户消息落库」当作完成。
- **范围**：`apps/web`、`apps/desktop`、`apps/mobile`、`packages/ui`、`packages/shared`、`e2e`、`apps/web/__tests__`
- **配套产物**：`product-reality-gap-audit-001-findings.json`、`e2e/tests/web/product-reality-gap-audit.spec.ts`（只读审计锚点）

## 1. 执行摘要

本次审计发现 **11 个问题**：P0 = 5、P1 = 4、P2 = 2。其中 **7 项为新发现**，4 项与既有 `PRODUCT-UAT-GAP-AUDIT-001`（2026-05-30）账本相关（含 1 项建议升级定级）。

**最严重的系统性结论**：AgentHub 的「Agent 真正执行 / 编排闭环」这一核心价值，在多个用户入口下并未达成——

1. **原生 Mobile App（React Native）的聊天完全是假的**——本地定时器回显，不接任何 runtime。此前 `MOBILE-CHAT-DELIVER-001` 修复的是 Web 内的 PWA 路由 `apps/web/app/m/`，**原生 `apps/mobile/` 从未被审计或修复**。
2. **Desktop「本地 Agent 会话」是纯 UI 占位**——输入指令只 `addActivity` echo 并硬编码 `status:'success'`；诊断/继续/重试/停止四个按钮无 `onClick`。renderer 从未连接 main 进程已有的真实 spawn / IPC 能力。
3. **Web 编排（计划/动作/审批）UI 从未上线**——`PlanCard`/`ActionCard` 组件已写好但全仓零引用，后端 `/api/plans`、`/api/actions` 可用却无界面入口。
4. **Web 右栏 Artifact 面板三 Tab 恒空态**——已登记（REG-20260530-007/008，P1），本审计建议升 P0。
5. **测试门禁存在 mock 假绿**——`artifact.spec.ts`/`messaging.spec.ts`/`workspace.spec.ts` 全程 `page.route` 伪造数据、只断言 `toBeVisible`，且 `messaging.spec.ts` mock `/api/chat` 后只断言用户消息气泡、从不断言 agent 回复。

> **对账重要性**：既有账本已正确确立「FakeExecutor 回显 ≠ Agent 链路成功」原则，并修复了 Web/PWA 的真实回复链路。本审计**不重复**已关闭项，而是揭示**同类问题在 Desktop、原生 Mobile、Web 编排 UI 三个从未覆盖的面**上仍然存在。

## 2. 验证说明（避免以代码阅读冒充用户态）

- 所有 **P0** finding 的代码位置均由审计主进程使用 Read 工具**逐文件打开核验**（非仅 subagent 摘要）：
  - `apps/mobile/src/screens/ChatScreen.tsx`、`apps/desktop/.../DesktopAgentSession.tsx`、`apps/web/components/workspace/ArtifactPanel.tsx`、`apps/web/lib/runtime/executor.ts`、`apps/web/server/runtime-worker.ts` 全文已读。
  - `PlanCard`/`ActionCard` 零引用、`/m/` 路由走 `/api/chat`、test mock 证据均由 grep 实证。
- **BLOCKED（受限项）**：本次 CLI 审计环境**未实际拉起** dev server（localhost:3000）、Electron renderer GUI、RN Metro/模拟器，因此**未采集真实用户态截图**。按任务红线，此为「真实环境缺失」标记，**不以代码阅读替代用户态结论**——P0 代码级证据充分但用户态视觉证据为 DEFERRED，已在 findings.json `blocked` 区登记，建议后续在可运行环境补齐。

## 3. Findings 明细

### P0

#### PRGA-001 · Mobile (React Native) 聊天发送 = 定时器回显假交互 · **新**
- **用户看到**：原生 Mobile App 聊天输入框 + 发送按钮。
- **用户以为**：发送后真实 Agent runtime 处理并回复。
- **实际发生**：`handleSend` 只 `setMessages` 本地数组，硬编码 `session_id='mobile-sess-1'`，`setTimeout(500ms)` 推入 `` `[Agent] 收到: "${原文}"` `` 回显；**无任何网络请求**。
- **代码位置**：`apps/mobile/src/screens/ChatScreen.tsx:13-50`（`App.tsx:5` 渲染此屏）。
- **为何 fake**：纯 local state + 字符串拼接回显，命中红线「发送只显示到列表 + 无真实链路」。
- **与既有账本关系**：区别于已关闭的 REG-20260530-006 GAP-002（那是 `apps/web/app/m/` PWA），本条是从未被审计的原生 RN App。
- **建议任务**：`MOBILE-RN-CHAT-RUNTIME-001`
- **应补断言**：发送触发真实 `/api/chat`（或 runtime client）；回复非「收到: 原文」回显；无 worker 时明确错误态；移除硬编码 `session_id`。

#### PRGA-002 · Desktop 输入指令只 addActivity echo · **新**
- **用户看到**：Desktop「本地 Agent 会话」输入框 + 发送。
- **用户以为**：本地 Claude Code / Codex runtime 真正执行指令。
- **实际发生**：`handleSend` 只 `addActivity({ status:'success', message: '[<agent>] <input>' })`，回显输入并**硬编码成功态**，不触发任何 IPC/spawn。
- **代码位置**：`apps/desktop/src/renderer/components/shell/DesktopAgentSession.tsx:14-20`。
- **为何 fake**：renderer 未连接 main 进程已有的 `StreamAdapter.spawn` / `DeviceChannel` runtime_invoke；命中红线「addActivity echo」。历史问题确认仍存在且无修复任务。
- **建议任务**：`DESKTOP-SESSION-RUNTIME-001`
- **应补断言**：发送后真实 runtime IPC 被调用；活动状态来自真实执行结果而非硬编码 success；收到 runtime 输出。

#### PRGA-003 · Desktop 诊断/继续/重试/停止 = 无 onClick 占位按钮 · **新**
- **用户看到**：composer 区四个控制按钮。
- **用户以为**：诊断/恢复/重跑/中止真实任务。
- **实际发生**：仅 `disabled={!selectedAgent}`，**无任何 onClick**；选中 Agent 点击也无反应。
- **代码位置**：`apps/desktop/src/renderer/components/shell/DesktopAgentSession.tsx:73-76`。
- **为何 fake**：纯视觉占位，无 runtime_cancel/diagnose/retry IPC，命中红线「按钮无真实结果」。
- **建议任务**：`DESKTOP-SESSION-CONTROLS-001`
- **应补断言**：点击每个按钮断言对应 IPC 被调用并产生 runtime 效果。

#### PRGA-004 · Web 编排 UI（PlanCard/ActionCard）僵尸组件，从未渲染 · **新**
- **用户看到**：（无）——Web 工作台无任何计划/动作/审批区域。
- **用户以为**：能看到计划节点进度、待审批动作、风险等级并审批。
- **实际发生**：`PlanCard.tsx`/`ActionCard.tsx` 已实现但**全仓 grep 零引用**；`WorkspaceShell` 只渲染 Sidebar/ChatPanel/ArtifactPanel。
- **代码位置**：`apps/web/components/orchestrator/PlanCard.tsx`、`ActionCard.tsx`（零引用）；`apps/web/components/workspace/WorkspaceShell.tsx`（无编排区）。
- **为何 fake**：后端 `/api/plans`、`/api/actions`、`/confirm`、`/approve` 全可用，但 Web 主界面完全不展示，编排→审批→执行闭环对 Web 用户不可达。命中红线「能力存在但永远不渲染/不接数据」。
- **建议任务**：`WEB-ORCHESTRATOR-UI-001`
- **应补断言**：创建计划后 Web 可见 PlanCard；高风险动作出现 ActionCard 且审批调用 `/api/actions/[id]/approve` 并改变真实状态。

#### PRGA-005 · Web Artifact 面板三 Tab 恒空态 · 已登记（建议升 P0）
- **用户看到**：右栏「产物 / 上下文 / Agents」三 Tab。
- **用户以为**：展示 Agent 产物、会话上下文、参与 Role Agent 真实数据。
- **实际发生**：三 Tab 全部硬编码 `StateCard variant="empty"`，**无任何数据获取**，永久空态。
- **代码位置**：`apps/web/components/workspace/ArtifactPanel.tsx:31-39`。
- **为何 fake**：`/api/role-agents`（Agents Tab 可复用）与 `messages` 表（产物可派生）均存在却从不查询。命中红线「Tab 永远空态不接数据」。
- **与既有账本关系**：已登记 `ARTIFACT-PANEL-DATA-001` / REG-20260530-007/008（P1）。本审计认为右栏占工作台三分之一、恒空壳误导性强，**建议升 P0**。
- **建议任务**：`ARTIFACT-PANEL-DATA-001`（沿用）
- **应补断言**：Agents Tab 内容与 `/api/role-agents` 一致；产物 Tab 在 agent 产出后非空且匹配 DB；去掉 mock。

### P1

#### PRGA-006 · 默认运行态 Agent 回复为回显/固定脚本（非真实 LLM）· 已登记
- **实际发生**：worker 默认 executor = `FakeExecutor`（`runtime-worker.ts:17`，逐词回显用户 prompt）；`RUNTIME_EXECUTOR=script` → `ScriptedRealExecutor` 固定串「已收到你的请求，这是运行时执行器返回的回复。」；仅 `RUNTIME_EXECUTOR=real` + 已装认证 CLI 才走真实 LLM。dev/E2E/docker 默认均非 real。
- **代码位置**：`apps/web/server/runtime-worker.ts:8-17`；`apps/web/lib/runtime/executor.ts:92-120`。
- **为何**：技术链路（200+SSE+落 `sender_type=agent`）可全通过，但默认产出非真实 Agent 能力。**该原则已被既有账本确立**（「FakeExecutor 回显≠完成」），本条为再确认 + 量化三种 executor 的确切产出，非冒充未知缺口。
- **建议任务**：`RUNTIME-REAL-EXECUTOR-E2E-001`
- **应补断言**：新增 `RUNTIME_EXECUTOR=real` 端到端冒烟（回复既非用户输入回显、又非固定脚本串）。

#### PRGA-007 · E2E `artifact.spec.ts` 全程 mock + 只 toBeVisible · **新**
- **实际发生**：`beforeEach` 用 `page.route` fulfill 伪造 sessions/messages/role-agents（行 41-48）；4 个 test 全部只断言 mock 数据 `toBeVisible`（行 52-83）。且其断言的 `Plan`/`Result`/`Artifact Detail` 文案在**当前** `workspace/ArtifactPanel.tsx`（恒空态）中根本不存在——测试绿过的是一个生产已不存在的面板形态。
- **代码位置**：`e2e/tests/artifact.spec.ts:41-83`。
- **为何门禁缺陷**：即使产品 panel 是空壳（PRGA-005），此测试仍 green pass，无法挡住假交互。
- **建议任务**：`TEST-ARTIFACT-REAL-DATA-001`
- **应补断言**：去 mock，断言 panel 内容与真实 `/api/role-agents` / `messages` 一致。

#### PRGA-008 · E2E `messaging.spec.ts` mock /api/chat + 不断言 agent 回复 · **新**
- **实际发生**：`page.route('**/api/chat', fulfill 固定 SSE)`（行 39-40）；发送后只断言用户气泡 `.bg-blue-500 getByText('你好')`（行 57），**从不断言 agent 回复**。
- **代码位置**：`e2e/tests/messaging.spec.ts:39-57`。
- **为何门禁缺陷**：agent 回复是 FR-CHAT-001 核心价值；mock 比 FakeExecutor 更假（直接伪造 SSE 响应体），且只验证用户侧。
- **建议任务**：`TEST-MESSAGING-REAL-CHAT-001`
- **应补断言**：去 `/api/chat` mock；断言 agent 回复非空非 echo；reload 后 user+agent 双持久化。

#### PRGA-010 · E2E `p0-main-flow.spec.ts` 条件保护跳过核心断言 · **新**
- **实际发生**：`if (await xxx.isVisible())` 包裹发送逻辑，元素不可见即静默跳过全部验证；发送 test 只断言无横滚/不重叠，**无消息发送成功/agent 回复/reload 断言**。
- **代码位置**：`e2e/tests/web/p0-main-flow.spec.ts:12-71`。
- **为何门禁缺陷**：条件保护使核心断言在多数环境静默跳过，命中红线「默认 skip 关键用户结果」。
- **建议任务**：`TEST-P0-FLOW-REAL-ASSERT-001`
- **应补断言**：移除 `if(isVisible)` 条件保护；发送后断言 `/api/chat` 响应 + 消息可见 + agent 回复（或明确错误态）+ reload 持久化。

### P2

#### PRGA-009 · E2E `workspace.spec.ts` 全程 mock + 只 toBeVisible · **新**
- **实际发生**：`page.route('**/api/workspaces', fulfill mock)`，只断言 `getByText().toBeVisible()`，不验证 CRUD 真实落库与归属。
- **代码位置**：`e2e/tests/workspace.spec.ts:9-55`。
- **建议任务**：`TEST-WORKSPACE-REAL-CRUD-001`
- **应补断言**：去 mock，创建后验证 DB 记录 + 列表与真实 API 一致 + 导航目标归属当前用户。

#### PRGA-011 · 遗留未用组件 `apps/web/components/chat/ChatPanel.tsx` 含英文占位 · **新**
- **实际发生**：含 `placeholder="Input message..."` / `Send`（英文），违反全局中文规范；grep 无引用（已被 `workspace/ChatPanel.tsx` 取代），但留存有被误引风险。
- **代码位置**：`apps/web/components/chat/ChatPanel.tsx:162,171`。
- **建议任务**：`WEB-LEGACY-CHAT-CLEANUP-001`
- **应补断言**：删除未用目录；CI 加未引用组件/英文文案扫描。

## 4. 已确认真实（白名单，避免误判）

| 链路 | 证据 | 结论 |
| --- | --- | --- |
| Web 发送 → `/api/chat` → Gateway → worker → SSE → 落库 | `session-store.ts` + `api/chat/route.ts` + `gateway.ts` | 链路真实（产出真实性见 PRGA-006） |
| Web/PWA `/m/sessions/[id]` 发送 → `/api/chat` SSE | `apps/web/app/m/sessions/[sessionId]/page.tsx:80` | 真实（MOBILE-CHAT-DELIVER-001 已修） |
| Gateway 无 worker 短路明确中文错误态 | `gateway.ts:126-131`（unconfigured/未就绪） | 真实，非静默吞 |
| Session/Workspace/Role-Agent/Messages CRUD | 各 `route.ts` + 归属校验 | 真实 |
| Desktop runtime 检测 / DeviceChannel ws / RuntimeConfigStore 落盘 / 设备绑定登录 | main 进程相应文件 | 真实（但 renderer 会话未接，见 PRGA-002/003） |
| 单测 `chat.test.ts` AT-005/006、`gateway-gating`、`executor`、`liveness`、`subscribe-timeout` | `apps/web/__tests__/` | 真实断言（no-fake-success） |
| 几何 UAT specs（layout/tooltip/floating-ui） | `e2e/tests/web/*` | 真实 boundingBox 断言 |

## 5. 后续修复任务清单（按 P0/P1/P2）

| 优先级 | Task ID | 面 | 摘要 |
| --- | --- | --- | --- |
| P0 | MOBILE-RN-CHAT-RUNTIME-001 | mobile | 原生 RN ChatScreen 接真实 runtime，去定时器回显 + 硬编码 session |
| P0 | DESKTOP-SESSION-RUNTIME-001 | desktop | 输入指令走真实 IPC/spawn，去 addActivity echo + 硬编码 success |
| P0 | DESKTOP-SESSION-CONTROLS-001 | desktop | 诊断/继续/重试/停止接 runtime IPC |
| P0 | WEB-ORCHESTRATOR-UI-001 | web | Web 工作台渲染 PlanCard/ActionCard + 审批入口 |
| P0 | ARTIFACT-PANEL-DATA-001（升级） | web | 右栏三 Tab 接真实数据（建议从 P1 升 P0） |
| P1 | RUNTIME-REAL-EXECUTOR-E2E-001 | runtime | 补 `RUNTIME_EXECUTOR=real` 端到端验证 |
| P1 | TEST-ARTIFACT-REAL-DATA-001 | test | `artifact.spec.ts` 去 mock + 真实断言 |
| P1 | TEST-MESSAGING-REAL-CHAT-001 | test | `messaging.spec.ts` 去 `/api/chat` mock + 断言 agent 回复 |
| P1 | TEST-P0-FLOW-REAL-ASSERT-001 | test | `p0-main-flow.spec.ts` 去条件保护 + 补核心断言 |
| P2 | TEST-WORKSPACE-REAL-CRUD-001 | test | `workspace.spec.ts` 去 mock + 验证落库 |
| P2 | WEB-LEGACY-CHAT-CLEANUP-001 | web | 删除遗留英文 `components/chat/` |

## 6. 账本/Tracker 更新建议

- **新建 regression 条目** `REG-20260531-010`（建议 ID）汇总本审计 P0 新缺口（PRGA-001/002/003/004），状态 `open`，关联 FR-CHAT-001/FR-RUNTIME-001/FR-DESKTOP-001/FR-MOBILE-001。
- **ARTIFACT-PANEL-DATA-001** 在 tracker 中由 P1 标注「审计建议升 P0」（REG-20260530-007/008 备注）。
- **新增测试门禁缺陷条目** `REG-20260531-011`（建议 ID）汇总 PRGA-007/008/009/010，状态 `open`。
- 在 tracker 顶部「阻塞问题/下一步」追加：原生 Mobile App、Desktop 本地会话、Web 编排 UI 三面的 Agent 闭环缺口为新增 P0 待修复，不得以测试态/视觉断言冒充完成。

> 本报告仅为审计输出，未修改任何产品代码或业务逻辑。
