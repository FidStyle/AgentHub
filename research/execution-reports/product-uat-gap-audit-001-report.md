# PRODUCT-UAT-GAP-AUDIT-001 — Web 全产品真实用户主链路缺口审计报告

> 任务类型：只读审计（不 execute、不修代码、不 commit）。
> 审计目标：发现类似 `ROLE-CHAT-CORE-001` 的「技术链路通过但用户目标没完成」缺口。
> 审计日期：2026-05-30。
> 判定红线：禁止把 API 被调用、按钮可见、用户消息落库当作完成。

---

## 1. 审计方法（真实环境，非只看代码）

| 维度 | 实际使用的真实环境 |
| --- | --- |
| 浏览器 | 真实 Chromium（Playwright `web-desktop` 1440×900），非 mock |
| DB | 真实 Postgres `agenthub_p0_test`（docker `agenthub_p0_postgres`），非内存 mock |
| Auth | 真实 Auth.js DB session cookie（`authjs.session-token`，seed fixture 用户），非 mock auth |
| Runtime/Redis | 真实 docker `agenthub_runtime_redis`（healthy）；按真实用户态分别测「无 REDIS_URL」「有 REDIS_URL 无 worker」 |
| 入口 | 真实 `pnpm dev:web` 启动的 localhost:3000 |

证据采集器：`e2e/tests/web/uat-gap-audit.spec.ts`（只读观察，不断言已知答案，观察结果归档至 `research/execution-reports/product-uat-gap-audit-001-browser-findings.json`）。

> 说明：审计未修改任何产品代码。该 spec 是临时证据采集器；是否保留为常驻回归门禁见第 5 节建议（GAP-001 关闭条件）。

### 真实环境配置观察（前置）

- 运行中的 `apps/web/.env.local` 指向 **Supabase 占位符**（`https://your-project.supabase.co`），不含可用 DB/REDIS_URL。真实用户用默认 `.env.local` 启动 `dev:web` 时，主链路 DB 实际不可用。本审计改用 P0 harness 同款真实 env（真实 Postgres + 真实 auth）才能跑通登录与主链路——这本身说明「默认开发入口的环境配置」与「可跑通主链路的环境配置」不一致（见 GAP-004）。

---

## 2. 核心结论

当前 Web 主链路在**真实用户态下，`@架构师`/任意 Agent 对话无法产生可见回复**。这是与 `ROLE-CHAT-CORE-001` 同类、且尚未真正关闭的 P0 缺口：技术信号（HTTP 200、SSE 打开、用户消息落库、角色可选、按钮可点）**全部通过**，但用户的真实目标——拿到架构师/Agent 的回复——**没有达成**。

真实浏览器实测（`browser-findings.json`）：

```
chat_http_status: 200
user_message_visible: true        ← 用户消息可见/落库
architect_visible: true           ← @架构师可选
saw_real_agent_reply: false       ← 用户从未看到真实回复  ★
```

并存在两种失败 regime（均经真实浏览器复现）：

| Regime | 入口 | POST /api/chat | 用户实际看到 |
| --- | --- | --- | --- |
| 1：无 REDIS_URL | 默认 `pnpm dev:web` | 200（快速） | `⚠️ 公共云端 Runtime 未就绪…`（有明确中文提示，但无回复） |
| 2：有 REDIS_URL 无 worker | `pnpm dev:full` 等 | **200，但挂起到 idle 超时**（实测注入 8s 超时即 8469ms；生产默认 idle=60s） | 长时间「发送中」后 `⚠️ 运行时执行失败，未收到回复` |

---

## 3. 缺口清单

### GAP-001 — Web @架构师/Agent 对话在真实用户态无可见回复（P0，ROLE-CHAT 同类未关闭）

- **用户症状**：登录 → 打开 cloud workspace → 新建会话 → `@架构师` → 发送问题 → 永远收不到架构师回复；要么立即提示「Runtime 未就绪」，要么「发送中」卡最多 60 秒后提示「运行时执行失败」。
- **复现步骤**（真实浏览器/DB/auth）：
  1. `pnpm dev:web`（或 `dev:full`）启动 localhost:3000，用真实 DB session 登录。
  2. 创建 `execution_domain=cloud` 的 workspace，打开 `/workspace/:id`，点「新建会话」。
  3. 点「提及角色」选「@架构师」，发送任意问题。
  4. 观察：`POST /api/chat` 返回 200、用户气泡出现并落库，但 `.bg-muted` agent 回复气泡始终不出现（无 `message-role-badge`）。
- **缺失断言**：现有验收只断言 `/api/chat` 被调用 / 200 / 用户消息落库 / 按钮可见，**没有断言「真实用户在默认运行入口下收到可见、非空、带角色标识的 agent 回复」**。唯一断言可见回复的 `e2e/tests/web/role-chat-uat-reply.spec.ts` 被 `test.skip(!RUNTIME_E2E)` 默认跳过，且仅在 `RUNTIME_E2E=1` + **FakeExecutor**（回显，非真实 Agent）下通过。
- **根因（代码级）**：
  1. `apps/web/lib/runtime/gateway.ts` `invoke()` 的 `public_cloud` 分支只用 `process.env.REDIS_URL` 判定可用性；当 `REDIS_URL` 存在但**无 worker 消费队列**时，仍 `yield public_runtime_available:true` 并 `enqueue`，随后 `subscribeEvents` 空等到 idle/total 超时（默认 60s/600s）才发 `runtime_failed`。`resolveEndpoint` 已算出的 `status:'unconfigured'` / `endpoint.id===null` **从未用于 gating**（死代码）。
  2. `apps/web/server/runtime-worker.ts` 默认 `FakeExecutor`；`RUNTIME_EXECUTOR=real` 也只在 worker 宿主跑本地 CLI，不存在已部署的云端 Agent worker。`pnpm dev:web` / `dev:full` **都不拉起任何 worker**。
- **真实环境佐证**：P0 DB 中 `runtime_endpoints` 行数=0、`runtime_sessions` 行数=0；`messages` 表 user=41 / agent=13（绝大多数用户消息无 agent 回复，且 13 条 agent 多来自 FakeExecutor 测试态）。
- **影响等级**：**P0 regression / blocker**——这是产品最核心的「多 Agent 协作回复」价值主张，真实用户 0 成功。
- **建议修复任务**：`ROLE-CHAT-RUNTIME-DELIVER-001`——(a) `dev:full` 默认拉起 worker，或在无 worker/`unconfigured` 时由 gateway **立即**短路为 `endpoint_unavailable`（不空等 60s）；(b) 用 `resolveEndpoint` 的 `status/id` 做真实 gating，删除死代码分歧；(c) 把 `role-chat-uat-reply` 的可见回复断言改为**默认运行入口可达**的常驻门禁（至少覆盖「无 worker → 立即明确错误态」与「有真实 worker → 可见回复」两条），禁止 `RUNTIME_E2E` 默认跳过掩盖主链路。

### GAP-002 — Mobile 发消息只写库、不触发任何 Runtime/Agent（P0，跨端不一致）

- **用户症状**：在 `/m/sessions/:id` 发消息，消息进气泡，但**永远不会有任何回复**，连「Runtime 未就绪」提示都没有——比 Web 更隐蔽的假成功。
- **复现步骤**：登录 → `/m` 选 workspace → 进会话 → 输入并发送 → 仅出现用户气泡，无任何 agent 回应或错误态。
- **缺失断言**：Mobile E2E 只覆盖列表/查看/未登录态，无「发送后用户目标达成或明确错误态」断言。
- **根因**：`apps/web/app/m/sessions/[sessionId]/page.tsx` `send()` 直接 `POST /api/messages`（纯写库），**不走 `/api/chat`**。这正是 `REG-20260530-001` 给 Web 修过的同类 bug，但 **Mobile 未同步修复**，违反合同 §3.1.8 / §6「消息发送必须闭环」「三端共享状态语义」。
- **影响等级**：P0（合同明确要求三端一致；移动端是 P0 端之一）。
- **建议修复任务**：`MOBILE-CHAT-DELIVER-001`——Mobile 发送走与 Web 一致的 `/api/chat` runtime 链路（或在轻量端明确「需在 Web 端继续」的闭环文案），并补 Mobile 发送后回复/错误态 E2E。

### GAP-003 — Artifact 面板（产物/上下文/Agents）恒为静态空态，从不接真实数据（P1）

- **用户症状**：右栏三个 Tab 都可点，但「Agents」永远显「暂无 Agent」，即使该 workspace 真实存在 23 个 role_agents（`/api/role-agents` 返回非空）；「产物」「上下文」同理恒空。
- **复现步骤**：打开任一 workspace → 右栏点「Agents」→ 始终「暂无 Agent」。
- **缺失断言**：无任何断言「面板内容与真实数据一致」。
- **根因**：`apps/web/components/workspace/ArtifactPanel.tsx` 三个 Tab 全是硬编码 `StateCard variant="empty"`，**完全没有 fetch**。
- **影响等级**：P1（合同 §3.1.10 要求三栏含 Artifact/Context/Agents；当前为「布局存在但功能空」）。
- **建议修复任务**：`ARTIFACT-PANEL-DATA-001`——Agents Tab 接 `/api/role-agents`；产物/上下文接对应数据源或显式标注 P1 未实现范围；补面板数据一致性断言。

### GAP-004 — 默认 `.env.local` 指向 Supabase 占位符，真实用户跑不通主链路（P1，环境/入口缺口）

- **用户症状**：照默认入口 `pnpm dev:web` 启动并登录，因 DB 指向 `your-project.supabase.co` 占位符，主链路实际不可用（本审计须切换到 P0 harness 真实 env 才能跑通）。
- **缺失断言**：无「默认开发入口启动后主链路可用」的冒烟。
- **影响等级**：P1（影响真实可演示性与新环境可复现性；与合同 §5 migration/seed/dev setup 可执行相关）。
- **建议修复任务**：`DEV-ENV-BOOTSTRAP-001`——提供可复现的本地真实 DB/REDIS env（或让 `dev:full` 自动指向 p0/dev DB），并补「默认入口启动 → 登录 → 主链路可用」冒烟。

---

## 4. 通过项（已真实达成，避免误报）

- 登录态（真实 Auth.js DB session）→ 受保护 `/workspace/:id` 可访问，未登录 `GET /` 307 重定向（真实鉴权生效）。
- Deep-link `/workspace/:id` 正确选中 URL workspace（`Sidebar` 不再覆盖）；「新建会话」真实 `POST /api/sessions` 201 并选中；点击 session 真实拉 `/api/messages`——`REG-20260530-001` 已修部分成立。
- 用户消息 reload 后从 DB 持久化恢复（`user_msg_after_reload:true`）。
- Runtime 不可用时确有**明确中文错误态**（regime 1 立即提示），符合「失败必须可见中文文案」——但仍不等于用户目标达成。
- Mobile `/m` 真实列出 workspace/session（真实 API），符合轻量查看定位。

---

## 5. 流程门禁缺陷（为什么之前的 verify/review 没发现）

符合 `ai-workflow-control.md` §5.1.1/§5.2「验真样本」判据——流程门禁不足，应先补门禁再修代码：

1. 唯一断言「可见 agent 回复」的测试默认 `skip`，使主链路最关键断言**默认不执行**。
2. 该测试即使执行也只验 **FakeExecutor 回显**，把「假回复」当「真回复」，违反 `maestro-execution-governance.md` Plan 硬门禁第 3 条（placeholder/hardcoded runtime 冒充 Agent 成功）。
3. goal-audit/verify 以 `status.json completed` + `toBeVisible` 收口，未对照合同「用户目标达成」逐项核验。

建议：先把「默认入口下可见真实 Agent 回复 / 或立即明确错误态」固化为不可跳过的门禁，再进入 GAP-001 修复。

---

## 6. regression-ledger 新增建议（建议，未写入 `research/regression-ledger.md`）

> 本只读审计不修改台账。以下为建议条目，供后续修复任务登记。
>
> **入账映射（closeout 2026-05-30）**：因 `REG-20260530-003` 已被既有「ROLE-CHAT-UAT-REPLY-001 测试态关闭」占用，本报告建议的 003/004/005 实际写入为 **REG-20260530-006/007/008**（见 `research/regression-ledger.md`）。其中 006 直接更正 003 的过早关闭。

### REG-20260530-003 — Web/Mobile Agent 回复在真实用户态不可达（覆盖 GAP-001 + GAP-002）

| 字段 | 建议内容 |
| --- | --- |
| 类型 | bug / unfinished / P0 regression |
| 优先级 | P0 blocker（阻塞继续扩大对话功能面） |
| 关联 FR/PRD | `FR-CHAT-001`, `FR-WEB-001`, `FR-MOB-001`, `FR-RUNTIME-001`, `FR-UI-001` |
| 关联任务/合同 | `P0-END-TO-END-PRODUCT-FLOW`；`ROLE-CHAT-CORE-001`；`ROLE-CHAT-UAT-REPLY-001` |
| 影响功能面 | Web `/api/chat` runtime 链路；Mobile `/m/sessions` 发送；公共云端 Runtime worker 部署 |
| 发现方式 | PRODUCT-UAT-GAP-AUDIT-001 真实浏览器 + 真实 DB + 真实 auth 审计 |
| 证据 | `research/execution-reports/product-uat-gap-audit-001-browser-findings.json`（`saw_real_agent_reply:false`，两 regime）；`POST /api/chat 200 in 8469ms`（idle 超时挂起）；P0 DB `runtime_endpoints=0`/`runtime_sessions=0`/`messages` user41:agent13；`gateway.ts` 未用 `unconfigured` gating；`runtime-worker.ts` 默认 FakeExecutor；`role-chat-uat-reply.spec.ts` 默认 skip |
| 为什么此前漏掉 | 唯一可见回复断言默认 `skip`，且仅验 FakeExecutor 回显；其余验收以 200/落库/可见为准 |
| 关闭条件 | 默认运行入口下：有真实 worker → 用户看到非空带角色回复并落 `messages`；无 worker → **立即**明确中文错误态（不空等 60s）；Mobile 发送走同一 runtime 链路或明确闭环文案；可见回复断言改为不可默认跳过的常驻门禁 |
| 下一步 | 拆 `ROLE-CHAT-RUNTIME-DELIVER-001` + `MOBILE-CHAT-DELIVER-001` |

### REG-20260530-004 — Artifact 面板恒静态空态未接数据（GAP-003，P1）

| 字段 | 建议内容 |
| --- | --- |
| 类型 | unfinished / UX | 优先级 | P1 |
| 关联 FR | `FR-WEB-001`, `FR-UI-001` | 证据 | `ArtifactPanel.tsx` 三 Tab 硬编码空态，无 fetch；`/api/role-agents` 同 workspace 返回非空 |
| 关闭条件 | Agents Tab 呈现真实 role_agents；产物/上下文接数据源或显式标注未实现范围 + 一致性断言 |

### REG-20260530-005 — 默认 `.env.local` 指向 Supabase 占位符（GAP-004，P1）

| 字段 | 建议内容 |
| --- | --- |
| 类型 | env / dev-setup | 优先级 | P1 |
| 证据 | `apps/web/.env.local` = `your-project.supabase.co` 占位符；须切换 P0 harness env 才能跑通主链路 |
| 关闭条件 | 默认入口启动 → 登录 → 主链路可用冒烟通过 |

---

## 7. project-tracker 更新建议（建议，未写入 `research/project-tracker.md`）

- **`WEB-WORKSPACE-UX-001` / `ROLE-CHAT-CORE-001`**：当前 tracker/ledger 描述「`sendMessage→/api/chat` 已修复、post-goal-audit 全通过」。审计发现：技术链路（走 `/api/chat`）确已接通，但**用户目标（看到回复）在默认运行入口下仍 0 成功**，且唯一可见回复断言默认 skip。建议将两项状态从「✅ 完成/待关闭」回退为「⚠️ 技术链路通过、产品目标未达成（见 REG-20260530-003）」，**不得转入关闭记录**，直至 GAP-001 关闭条件满足。
- **`P0-END-TO-END-PRODUCT-FLOW`**：tracker 标「✅ 端到端验证通过（2026-05-29）」。审计发现 Agent 回复主价值在真实用户态不可达 + Mobile 发送无回复 + Artifact 空壳；建议在该任务条目「阻塞问题」补登 REG-20260530-003，并明确「FakeExecutor 回显 ≠ Agent 链路成功」，避免再以单测/E2E 视觉断言冒充产品完成。
- 新增三条任务跟踪行：`ROLE-CHAT-RUNTIME-DELIVER-001`(P0)、`MOBILE-CHAT-DELIVER-001`(P0)、`ARTIFACT-PANEL-DATA-001`(P1)、`DEV-ENV-BOOTSTRAP-001`(P1)。

---

## 8. 残留进程 / 工作区状态

- 审计用 `pnpm dev:web` 由 Playwright global-teardown 关闭；最终 `lsof :3000` 干净，无残留 web/worker 进程。docker `agenthub_p0_postgres` / `agenthub_runtime_redis` 为既有常驻服务，未由本审计创建、未关闭。
- 审计阶段未修改任何产品代码。closeout 阶段仅入账：本报告、`e2e/tests/web/uat-gap-audit.spec.ts`（只读证据采集器）、`product-uat-gap-audit-001-browser-findings.json`（由临时 scratchpad 移入 `research/execution-reports/`，不提交 `.workflow/.scratchpad/`）、`research/regression-ledger.md`（REG-20260530-003/004/005）、`research/project-tracker.md`（状态降级 + 后续任务登记）。
- closeout 前在途的 `ROLE-CHAT-UAT-REPLY-001` 改动已由上一会话提交（`5a8d716`）；本任务工作区仅含上述审计/账本产物，不触碰产品代码。
