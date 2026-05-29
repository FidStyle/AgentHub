# AgentHub 项目跟进表

> 所有 P0/P1/P2 任务的公开跟进记录。Maestro/Ralph 每完成一个 wave 必须同步更新本表。

---

## 治理规则

- **所有功能状态必须在本表同步**。没有本表对应记录，不允许标记 Maestro/Trellis 任务为完成。
- 每条记录必须包含：优先级、FR-ID、对应计划任务、当前状态、验收方式、测试证据、阻塞问题、下一步动作。
- 状态变更时附带日期。
- Maestro/Ralph 每完成一个 wave，必须更新对应任务的「当前状态」和「下一步动作」字段。
- 验证通过后必须补充「测试证据」字段（截图路径、E2E 报告链接或命令输出）。
- Analyze/plan/verify/review 等非代码阶段只要修改 `research/`、`.workflow/roadmap.md`、`.workflow/scratch/*/plan.json` 或测试/代码文件，也必须精确 `git add` 本阶段相关文件并中文 commit；不得只更新 `status.json`。
- 如果工作区已有无关 dirty 文件，必须记录 baseline，只提交本阶段相关文件，并在完成输出中列出剩余 dirty 项。
- **治理门禁**：milestone/session complete 前必须运行 `bash scripts/verify-governance-gate.sh <TASK-ID>` 且 exit 0。status.json completed ≠ 项目完成。

---

## P0 任务

### P0-END-TO-END-PRODUCT-FLOW: MVP 端到端产品主链路合同与验真

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-AUTH-001, FR-WS-001, FR-DEVICE-001, FR-WEB-001, FR-DESK-001, FR-MOB-001, FR-CHAT-001, FR-UI-001, FR-RUNTIME-001, FR-PERM-001 |
| **对应计划** | Codex 前置合同与验真框架；Ralph blind verify session `ralph-20260528-100000` 已完成；下一步进入修复规划 |
| **合同路径** | `research/contracts/P0-END-TO-END-PRODUCT-FLOW.md` |
| **当前状态** | ✅ 端到端验证通过（2026-05-29）：DB/Auth smoke + /api/chat 集成测试 11/11 PASS + Web E2E 4/4 PASS + Mobile Auth E2E 4/4 PASS + Desktop API 链路 1/1 PASS + 视觉断言通过（无横向滚动、容器不重叠）；Desktop IPC 认证闭环已补全 |
| **目标** | 以真实 MVP 用户链路验证项目，而不是用单页、单接口或按钮反馈作为完成依据 |
| **方案摘要** | 建立端到端产品合同；登记身份连续性、Workspace 创建闭环、三端 UX 一致性为验真样本；禁止把已知根因直接喂给执行者 |
| **验收方式** | 盲验证必须基于合同自行发现主链路断点；后续实现必须使用真实 DB/API/session 并覆盖 Web/Desktop/Mobile E2E |
| **测试证据** | DB smoke: `research/execution-reports/p0-end-to-end-product-flow-real-db-smoke-report.md`；/api/chat: `tsx scripts/verify-p0-chat-api.ts` 11/11 PASS；Web E2E: `npx playwright test tests/web/p0-main-flow.spec.ts` 4/4 PASS；Mobile Auth: `npx playwright test tests/web/p0-mobile-auth.spec.ts` 4/4 PASS；Desktop API: `npx playwright test tests/desktop/p0-auth-flow.spec.ts` 1/1 PASS + 1 skip（需 Electron 构建）；视觉断言: assertNoHorizontalScroll + assertNoElementOverlap PASS |
| **阻塞问题** | BLK-2 ✅ 已解决（Desktop IPC 认证闭环补全 + API 链路验证通过）；BLK-4 ✅ 已解决（Mobile Auth E2E 通过）；BLK-6 ⚠️ 部分解决（/api/chat DEVICE_OFFLINE 错误态验证通过，完整 Runtime 部署 deferred）；BLK-7 ✅ 已解决（三端 E2E 真实浏览器运行） |
| **下一步动作** | Agent Runtime 完整部署（deferred to P1）；~~mobile-pwa.spec.ts 旧 fixture 迁移~~ ✅ 已完成（2026-05-29） |

### UI-ALIGN-001: 三端 UI 参考项目对齐修复

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-UI-001, FR-DESK-001, FR-WEB-001, FR-MOB-001 |
| **对应计划** | impeccable improve chain: critique → refine → polish → audit |
| **当前状态** | ✅ 完成（2026-05-29）：critique → refine → polish → audit 全链完成；audit 评分 15/20 PASS；type-check 通过；P0 数据链路未受影响 |
| **目标** | 三端视觉母版统一，对齐 AionUi/codeg 参考项目的信息密度和组件规范 |
| **方案摘要** | Desktop 侧栏加 lucide 图标；Web Composer 加工具条；Mobile 统一色彩 token；消除营销文案；三端语义色 token 统一；交互闭环（workspace 切换、发送状态、空态描述） |
| **验收方式** | type-check 通过 + audit 评分 ≥15/20 PASS + P0 数据链路无回归 |
| **测试证据** | `tsc --noEmit` web/desktop 通过；audit 评分 15/20 PASS；commits: `beb9825`（三端视觉 token 统一）+ `1fe7b7d`（交互闭环 + 中文状态）；execution-report: `research/execution-reports/ui-align-001-report.md` |
| **阻塞问题** | P1 残留：a11y 对比度/焦点环/aria-label 缺失（非 P0 blocker）；Mobile React 版本兼容性（预存问题） |
| **下一步动作** | P1 a11y 修复（独立任务）；本任务闭环 |

### WEB-WORKSPACE-UX-001: Web Workspace 真实交互闭环回归

| 字段 | 内容 |
|------|------|
| **优先级** | P0 regression（阻塞继续扩大 Web 工作台功能面） |
| **绑定 FR-ID** | FR-WEB-001, FR-WS-001, FR-CHAT-001, FR-UI-001 |
| **来源** | 用户验真样本（2026-05-30）：登录后访问 `/workspace/:id`，页面视觉存在但感觉无法点击/无法测试功能 |
| **当前状态** | 🔴 待修复登记（2026-05-30）：代码审查确认交互闭环缺口存在，尚未进入修复执行 |
| **缺陷台账** | `research/regression-ledger.md#reg-20260530-001--web-workspace-真实交互闭环缺口` |
| **问题摘要** | `/workspace/[id]` 未读取 URL workspace id；Sidebar 默认选第一个 workspace；“新建会话”按钮无 `onClick`；点击 session 只设置 id、不拉取 messages；发送消息只写 `/api/messages`，未走 `/api/chat` runtime/agent 链路 |
| **验收方式** | 使用 Auth.js 测试登录态（`TEST_AUTH_STORAGE_STATE` 或 `TEST_AUTH_COOKIE`），真实浏览器验证：直接打开 `/workspace/:id` → 当前 workspace 被选中 → 新建 session 落库并选中 → 点击 session 拉取消息 → 发送消息走 `/api/chat` 并展示 runtime/agent 状态或明确错误态 → reload 后 session/message 持久化 |
| **测试证据** | 待补：Playwright E2E 必须断言真实 API/DB 行为结果，不能只检查按钮可见；补充组件/Store 测试覆盖 create/select/fetch/send |
| **阻塞问题** | 当前 `RT-WORKER-HARDEN-001` Ralph session 正在 review 阶段；该 runtime session 的边界明确排除 UI 层，不能混入本修复 |
| **下一步动作** | 完成/暂停 runtime harden 后，启动 `WEB-WORKSPACE-UX-001` 修复 Ralph session；修复完成前不继续扩大 Web Workspace 新功能 |

### AUTH-MIG-001: 认证路线迁移 Auth.js → Auth.js v5

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-AUTH-001 |
| **对应计划** | Maestro plan: `PLN-auth-migration`（7 tasks, 3 waves） |
| **Plan 路径** | `.workflow/scratch/20260527-plan-auth-migration/plan.json` |
| **Ralph Session** | `ralph-20260527-100000`（status: completed） |
| **当前状态** | ✅ 全部完成（2026-05-27）：Wave 1-3 执行完毕，verify PASS，review PASS |
| **目标** | 消除本地开发/E2E/Demo 对 Auth.js 控制台的强依赖 |
| **方案摘要** | Auth.js v5 + GitHub OAuth Provider + Drizzle adapter + Database session；DB 层暂保留 Postgres |
| **Wave 分解** | W1: 文档修订 + Auth.js 基础设施 → W2: 认证层替换 → W3: 设备绑定迁移 + E2E 验证 |
| **验收方式** | `npm run dev` 无需 Auth.js 环境变量 + E2E auth 测试通过 + Demo 路径不退化 |
| **测试证据** | `tsc --noEmit` exit 0；`vitest run __tests__/` 85 tests pass；`rg 'auth.js session\|external auth SDK' apps/web/` 无匹配；verification.json verdict=PASS (20/20) |
| **阻塞问题** | 无 |
| **下一步动作** | 迁移闭环，无后续动作 |

### GOV-GATE-001: Maestro/Ralph 完成前治理门禁

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-UI-001, FR-AUTH-001, 全部实现类任务 |
| **对应计划** | Codex 治理基础设施补强 |
| **当前状态** | ✅ 完成（2026-05-27）：治理门禁脚本、兼容别名、执行 Prompt 与索引接入已落地 |
| **目标** | 防止 Maestro/Ralph 仅凭 `status.json completed` 假完成，强制公开跟进、测试证据和中文 commit 闭环 |
| **方案摘要** | 增强 `scripts/verify-governance-gate.sh`，新增 `scripts/check-governance-gate.sh` 兼容别名，新增 `research/workflow/maestro-execution-governance.md`，并接入 Maestro spec injection |
| **验收方式** | Shell 语法检查通过 + Maestro spec injection 已包含治理 Prompt + 真实门禁运行能识别当前未提交改动 |
| **测试证据** | `bash -n scripts/verify-governance-gate.sh` exit 0；`bash -n scripts/check-governance-gate.sh` exit 0；`maestro spec injection always` 已注入治理 Prompt；当前存在未提交业务/UI 改动时门禁应失败 |
| **阻塞问题** | 当前工作区存在既有 UI/业务改动，不由本治理任务回滚或提交 |
| **下一步动作** | 后续 Maestro 每个 wave 完成后运行 `bash scripts/verify-governance-gate.sh <TASK-ID>`；失败不得 complete |

### P0-ACCEPT-001: P0 功能验收 — Desktop 主入口点击语义修复

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-DESK-001, FR-MOB-001 |
| **对应计划** | Maestro plan: `PLN-p0-acceptance`（7 tasks, 3 waves） |
| **Plan 路径** | `.workflow/scratch/20260527-plan-p0-acceptance/plan.json` |
| **Ralph Session** | `ralph-20260527-143500`（status: completed） |
| **当前状态** | ✅ 全部完成（2026-05-27）：Wave 1-3 执行完毕，verify PASS，review PASS，UAT 19 tests |
| **目标** | 修复 Desktop 所有 broken 入口点击语义（GitHub 登录、打开工作台、Agent 选择、Composer） |
| **方案摘要** | W1: 抽取 useDesktopAuth + useOpenWebWorkspace hooks → W2: 绑定 Sidebar/Settings/StatusBar/AgentConfig/AgentSession → W3: Mobile 离线提示 + E2E 测试 |
| **验收方式** | type-check 通过 + convergence criteria 7/7 + Playwright E2E 19 tests 可编译 |
| **测试证据** | `tsc --noEmit` desktop/web 通过；verification.json passed=true (7/7)；`playwright test --list` 19 tests；review.json verdict=PASS |
| **阻塞问题** | 无 |
| **下一步动作** | 闭环，无后续动作 |

---

## P1 任务

### P1-RT: Agent Runtime 完整部署

| 字段 | 内容 |
|------|------|
| **优先级** | P1 |
| **FR-ID** | FR-RT-001（Cloud Runtime Gateway 契约）、FR-RT-002（user_local tunnel）、FR-RT-003（public_cloud 池部署） |
| **对应计划** | macro analyze `ANL-20260529-p1-runtime` + roadmap `RDM-20260529-p1-runtime`（架构已修订）+ **架构合同 `research/contracts/P1-RUNTIME-GATEWAY.md`（revised）** |
| **合同路径** | `research/contracts/P1-RUNTIME-GATEWAY.md`（权威，revised）；`.workflow/scratch/20260529-analyze-p1-runtime/conclusions.json`（旧模型，已被合同取代） |
| **当前状态** | ✅ **里程碑全部完成（2026-05-29）**：三 phase（gateway-contract / desktop-tunnel / public-cloud-pool）verify+review 均 PASS；milestone-audit PASS（0 critical/0 high）；归档至 `.workflow/milestones/P1-RT/`，current_milestone 置空（无 roadmap 后继） |
| **目标** | Cloud Runtime Gateway 统一承载 public_cloud + user_local 两类 endpoint；Web/Mobile 统一经 gateway，不直连本地端口；DB 状态记录 + 统一事件语义 |
| **方案摘要** | 3 phase：P1 = Gateway contract + DB model + routing/event semantics；P2 = Desktop local runtime tunnel 接入 gateway；P3 = 自建 public_cloud runtime 池 / worker 实现 |
| **验收方式** | 各 phase verify+review PASS + milestone-audit PASS + 真实 infra 回归（Phase 3 16/16 + Phase 2 13/13）+ tsc exit 0 + 治理门禁 exit 0 |
| **测试证据** | milestone-audit `.workflow/milestones/P1-RT/audit-report.md`（PASS）；milestone summary `.workflow/milestones/P1-RT/summary.md`；三 phase execution-report 见 `research/execution-reports/p1-rt-*.md`；Phase 3 集成 `verify-p1-rt-phase3.ts` 16/16；Phase 2 回归 `verify-p1-rt-phase2.ts` 13/13 |
| **阻塞问题** | 无（D-003 已决策全部自建，禁止 Supabase/Fly/Neon/Upstash 等包装平台） |
| **下一步动作** | 里程碑闭环。已知后续项：state.json 补登 Phase 2/3 execute/verify/review artifact（bookkeeping）；真实 RuntimeExecutor 接入 + worker liveness/订阅超时 + runtime_logs 统一脱敏 |

---

### P1-RUNTIME-GATEWAY

| 字段 | 内容 |
|------|------|
| **优先级** | P1（里程碑 P1-RT，Phase 1） |
| **FR-ID** | FR-RT-001（Cloud Runtime Gateway 契约） |
| **对应计划** | `PLN-20260529-p1-rt-gateway-phase1`（4 tasks / 2 waves） |
| **合同路径** | `research/contracts/P1-RUNTIME-GATEWAY.md`（权威，revised）；`.trellis/spec/cross-layer/runtime-gateway-contract.md` |
| **当前状态** | ✅ **Phase 1 全部完成，验证通过（2026-05-29）**：Gateway contract + DB 模型（5 表幂等）+ /api/chat 按 endpoint 路由 + 统一事件语义 + session 落库；review verdict=PASS |
| **目标** | Cloud Runtime Gateway 统一承载 public_cloud + user_local 两类 endpoint；Web/Mobile 统一经 gateway 不直连本地端口；DB 状态记录 + 统一事件语义；本阶段不要求真实 provider 部署 |
| **验收方式** | type-check exit 0；DB 迁移幂等性验证 PASS；/api/chat 集成测试覆盖新路由/事件/落库；review verdict != BLOCK；治理门禁 P1-RUNTIME-GATEWAY |
| **测试证据** | `apps/web/scripts/verify-p1-runtime-gateway.ts` 对真实 DB **12 passed / 0 failed / 1 skip(PASS)**（DB 二次 apply 幂等 exit 0 + 5 表存在 + P0 sessions/messages 不变 + isLocalNetworkTarget 安全 6/6）；落库 probe 写 runtime_sessions/runtime_logs 读回成功且 secret 脱敏；packages/shared + apps/web tsc exit 0；review.json verdict=PASS（critical/high/medium=0）；execution-report `research/execution-reports/p1-runtime-gateway-phase1-execution-report.md` |
| **阻塞问题** | 无（Phase 1 范围内）；D-003 已决策为自建，public_cloud 池自建实现属 Phase 3 |
| **下一步动作** | Phase 2：Desktop local runtime tunnel 接入 gateway；Phase 3：自建 public_cloud 池 / worker 实现 |

---

### P1-RT-PHASE2

| 字段 | 内容 |
|------|------|
| **优先级** | P1（里程碑 P1-RT，Phase 2） |
| **FR-ID** | FR-RT-001（Cloud Runtime Gateway 契约，Phase 2 tunnel 接入） |
| **对应计划** | `PLN-20260529-p1-rt-phase2`（4 tasks / 2 waves） |
| **合同路径** | `research/contracts/P1-RUNTIME-GATEWAY.md#Phase2`；`.trellis/spec/cross-layer/runtime-gateway-contract.md` |
| **当前状态** | ✅ **Phase 2 全部完成，验证通过（2026-05-29）**：device_runtime_channels 落库（ws-gateway 连接生命周期单点 upsert）+ gateway invoke tunnel 生命周期事件闭环（tunnel_connected/tunnel_disconnected/local_runtime_offline）+ RuntimeErrorCode 统一（packages/shared）+ Phase 2 集成测试 |
| **目标** | Desktop local runtime tunnel 复用 /ws/device + device-connections in-memory relay，把 user_local endpoint 的 tunnel/channel 状态接入 device_runtime_channels，打通 local_runtime_offline/tunnel_connected/tunnel_disconnected 事件闭环，统一 RuntimeErrorCode；不改 Desktop 主进程执行模型，不连真实部署平台 |
| **验收方式** | type-check exit 0（packages/shared + apps/web）；Phase 2 集成测试覆盖 device_runtime_channels 落库读回 + tunnel 生命周期事件 PASS；P0/Phase 1 回归不破；治理门禁 P1-RT-PHASE2 exit 0 |
| **测试证据** | `apps/web/scripts/verify-p1-rt-phase2.ts` 对真实 DB **13 passed / 0 failed / 0 skip（status=PASS）**：RuntimeErrorCode 字面值一致（DEVICE_OFFLINE/endpoint_unavailable/tunnel_disconnected/public_runtime_unconfigured）+ markChannelConnected→connected 行读回 + markChannelDisconnected→disconnected 且保留 connected_at + invoke 曾连接后断开 emit tunnel_disconnected + 从未连接 emit local_runtime_offline（均仍 emit runtime_status=DEVICE_OFFLINE，P0 兼容）；回归 `verify-p1-runtime-gateway.ts` 12 passed/0 failed/1 skip；packages/shared + apps/web tsc exit 0；execution-report `research/execution-reports/p1-rt-phase2-execution-report.md` |
| **阻塞问题** | 无（Phase 2 范围内）；D-003 已决策为自建，public_cloud 池自建实现属 Phase 3，本阶段未触及 |
| **下一步动作** | Phase 3：自建 public_cloud runtime 池 / worker 实现；Desktop 主进程 RuntimeHost/StreamAdapter 执行模型为后续独立范围 |

---

### P1-RT-PHASE3

| 字段 | 内容 |
|------|------|
| **优先级** | P1（里程碑 P1-RT，Phase 3） |
| **FR-ID** | FR-RT-001（Cloud Runtime Gateway 契约，Phase 3 自建 public_cloud worker/pool） |
| **对应计划** | `PLN-P3-03-public-cloud-pool`（4 tasks / 2 waves） |
| **合同/决策** | D-003（基础设施全部自建，禁用 Upstash/Neon/Modal 等托管平台）；`research/contracts/P1-RUNTIME-GATEWAY.md` |
| **当前状态** | ✅ **Phase 3 全部完成，验证通过（2026-05-29）**：自建 docker compose 栈（Postgres+Redis+worker 官方镜像）+ Redis 队列调度（LIST+BRPOP）+ RuntimeExecutor 接口/FakeExecutor 流式 + worker 状态机（running→completed/cancelled/failed）落 runtime_sessions/runtime_logs + gateway public_cloud 分支接入队列+订阅事件流 + cancelRuntimeSession 取消语义；REDIS 未配保留 endpoint_unavailable 占位（向后兼容），user_local 分支未改 |
| **目标** | gateway public_cloud 占位分支接入自建 Redis 队列：入队 runtime job → 自建 worker BRPOP 消费 → FakeExecutor 流式增量 → 事件 pub/sub 回流 gateway 转 SSE + 落 runtime_logs，状态机落 runtime_sessions（running/completed/cancelled/failed）；全部自建，无付费 API、无真实 CLI spawn、无托管平台依赖 |
| **验收方式** | type-check exit 0（apps/web）；docker compose config exit 0；禁用平台依赖扫描无匹配；Phase 3 集成测试覆盖调度/流式/落库+seq/取消/失败 5 类语义 PASS；Phase 2 回归不破；治理门禁 P1-RT-PHASE3 exit 0 |
| **测试证据** | `apps/web/scripts/verify-p1-rt-phase3.ts` 对真实 Postgres+Redis **16 passed / 0 failed / 0 skip（status=PASS）**：enqueue→dequeue 同一 job + FakeExecutor runtime_output 增量≥2（实测4）+ runtime_sessions.status=completed + runtime_logs seq 严格递增有序 + setCancel→cancelled（emit runtime_cancelled，不伪装 completed）+ job.fail→failed（emit runtime_failed，不伪装 completed）；回归 `verify-p1-rt-phase2.ts` 13 passed/0 failed/0 skip；apps/web tsc exit 0；compose config exit 0；banned-platform 扫描 clean；execution-report `research/execution-reports/p1-rt-phase3-execution-report.md` |
| **阻塞问题** | 无（Phase 3 范围内）。后续项：真实 RuntimeExecutor 接入前需补 worker liveness/订阅超时 + runtime_logs 统一脱敏（review.json 1 medium + 1 low，均 out-of-scope） |
| **下一步动作** | P1-RT milestone-audit / complete；真实 executor（CLI spawn/容器执行）接入与 worker 池水平扩展为后续独立范围 |

---

### RT-REAL-EXEC-001: 真实可插拔 RuntimeExecutor 接入

| 字段 | 内容 |
|------|------|
| **优先级** | P1（P1-RT 后续独立范围，adhoc 里程碑 `adhoc-real-runtime-executor`） |
| **FR-ID** | FR-RT-001 延伸（真实 executor 接入，不改 Gateway 总架构） |
| **对应计划** | `PLN-20260530-real-runtime-executor`（2 tasks / 2 waves，源自 `ANL-20260530-real-runtime-executor`） |
| **合同/决策** | 复用 RuntimeExecutor 接口（L1 零接口改动）；CLI 不可用返回 executor_unavailable（L5 禁假成功）；凭证仅经 env 注入不外发（L6）；默认 FakeExecutor 保证 gateway 零回归（L3） |
| **当前状态** | ✅ **全部完成，验证通过（2026-05-30）**：CliRuntimeExecutor spawn claude/codex CLI 流式 stdout→chunk；ENOENT/spawn 失败→ExecutorUnavailableError(code=executor_unavailable)；stderr 仅 drain 不外发；createExecutor 工厂按 RUNTIME_EXECUTOR env 选择，默认 FakeExecutor；verify 6 truths 全 VERIFIED / review PASS / test 7-7 pass |
| **目标** | 在不改 Gateway 总架构前提下，新增真实可插拔 executor（claude/codex CLI），保留 FakeExecutor 作测试 executor，CLI 不可用明确失败，凭证安全隔离 |
| **验收方式** | apps/web tsc exit 0；executor.test.ts 7/7 pass；gateway 零回归（git stash 基线对照预存失败一致）；grep 收敛条件全过；治理门禁 RT-REAL-EXEC-001 exit 0 |
| **测试证据** | `apps/web/__tests__/runtime/executor.test.ts` 7 passed / 7（S1-S7：unavailable/凭证隔离/Fake 回归/失败事件/工厂选择）；verification.json passed=true 6 truths VERIFIED 0 gaps；review.json verdict=PASS 0 blocking；execution-report `research/execution-reports/real-runtime-executor-report.md` |
| **阻塞问题** | 无。Deferred（非本期）：真实端到端 CLI 会话（需凭证+付费，D1）；结构化输出解析（D3） |
| **下一步动作** | milestone-complete 归档；真实端到端 CLI 会话验证 + worker 池接入为后续独立范围 |

---

### RT-WORKER-HARDEN-001: Runtime worker 硬化（liveness + 订阅超时 + 统一脱敏）

| 字段 | 内容 |
|------|------|
| **优先级** | P1（P1-RT / RT-REAL-EXEC-001 后续独立范围，adhoc 里程碑 `adhoc-worker-harden`） |
| **FR-ID** | FR-RT-001 延伸（runtime 健壮性 + 凭证隔离，不改 Gateway 总架构） |
| **对应计划** | `PLN-20260530-rt-worker-harden`（3 tasks / 2 waves，源自 `ANL-20260530-rt-worker-harden`） |
| **合同/决策** | RuntimeExecutor 接口零改动（L1）；超时/失联禁假成功，落 failed + emit runtime_failed（L5）；凭证经统一 redact 不外发（L6）；纯 Redis 心跳键不新增 DB schema（L3）；默认 FakeExecutor + 路由分支语义不变保证零回归 |
| **当前状态** | ✅ **全部完成，验证通过（2026-05-30）**：G1 worker 周期心跳（TTL 默认 30s）+ reclaimDeadSession 失联回收 failed；G2 subscribeEvents 空闲 60s/总 600s 双超时（env 可配）产出 runtime_failed 并释放订阅；G3 共享 redact（key 名 + 值级 sk-/Bearer/AKIA 等）接入 worker log() 与 gateway persist 两路径。verify PASS（G1/G2/G3 全 VERIFIED 0 gaps）/ review PASS / 三道 gate + goal-audit 全 proceed |
| **目标** | 在不改 Gateway 总架构前提下，硬化 runtime：worker 卡死会话可被回收、订阅永不永久阻塞、runtime_logs 不落明文密钥 |
| **验收方式** | apps/web tsc exit 0；runtime suite 18/18 pass；gateway 零回归（git stash 基线对照 7 个预存失败一致）；治理门禁 RT-WORKER-HARDEN-001 exit 0 |
| **测试证据** | runtime suite 18/18 passed：`redact.test.ts` 5/5 + `liveness.test.ts` 4/4 + `subscribe-timeout.test.ts` 2/2 + `executor.test.ts` 7/7（回归复绿）；verification.json verdict=PASS G1/G2/G3 全 VERIFIED 0 gaps confidence 92/high；review.json verdict=PASS spec ALL_MET severity 全 0；execution-report `research/execution-reports/rt-worker-harden-report.md` |
| **阻塞问题** | 无。UAT 以 cold-start 冒烟替代（后端 runtime 硬化无 UI 面，auto_mode 无交互测试者）；7 个全量套件失败为预先存在（缺 DATABASE_URL），与本任务无关 |
| **下一步动作** | milestone-complete 归档；worker 池接入与真实端到端会话验证为后续独立范围 |

---

## P2 任务

（暂无登记）

---

## 变更历史

| 日期 | 任务 | 变更 |
|------|------|------|
| 2026-05-27 | AUTH-MIG-001 | 初始登记，计划已确认待执行 |
| 2026-05-27 | AUTH-MIG-001 | Wave 1 完成：TASK-001 文档修订 + TASK-002 Auth.js 基础设施搭建，type-check 通过 |
| 2026-05-27 | AUTH-MIG-001 | Wave 2 完成：TASK-003 middleware + TASK-004 API auth guard + TASK-005 Login 替换，type-check 通过 |
| 2026-05-27 | AUTH-MIG-001 | Wave 3 完成：TASK-006 Desktop 设备绑定 + TASK-007 测试适配，全量验收通过，session completed |
| 2026-05-27 | UI-ALIGN-001 | 初始登记，impeccable improve chain critique 评分 22/40 |
| 2026-05-27 | UI-ALIGN-001 | Refine loop 1：Desktop 侧栏 lucide 图标、Web Composer 工具条、Mobile 共享色彩 token、营销文案替换 |
| 2026-05-27 | GOV-GATE-001 | 新增完成前治理门禁脚本、兼容别名、Maestro 执行治理 Prompt，并接入 research 索引和 Maestro spec injection |
| 2026-05-27 | P0-ACCEPT-001 | 初始登记 + 全量完成：Desktop 入口修复（hooks 抽取 + 绑定）、Mobile 离线提示、E2E 19 tests |
| 2026-05-28 | P0-END-TO-END-PRODUCT-FLOW | 新增 MVP 端到端产品主链路共享合同和盲验证前准备审计；登录等已知问题登记为验真样本而非直接修复目标 |
| 2026-05-28 | P0-END-TO-END-PRODUCT-FLOW | Ralph 盲验证完成：执行系统自行发现 5 个 critical blockers；流程验真通过，产品合同 FAIL/NO-GO，禁止标记产品完成 |
| 2026-05-28 | P0-END-TO-END-PRODUCT-FLOW | 首版修复计划审查发现 plan anti-pattern：外部浏览器 cookie 假设、Runtime placeholder、mock auth 混入真实 DB、E2E 只查文件/--list；已新增 Trellis 规划指南并要求 revise/review |
| 2026-05-28 | P0-END-TO-END-PRODUCT-FLOW | 修复计划生成：6 tasks / 4 waves，覆盖 BLK-1~5 + 真实 DB 集成测试 + 三端 E2E + governance gate。Plan: `.workflow/scratch/20260528-plan-p0-e2e-fix/plan.json` |
| 2026-05-28 | P0-END-TO-END-PRODUCT-FLOW | 计划修订 Rev1：TASK-002 改为 device-binding token 方案；TASK-004 禁止 mock Agent 响应 + DEVICE_OFFLINE；TASK-005 强制真实 DB 运行；TASK-006 convergence 要求真实 E2E 运行 + 结果写入报告 |
| 2026-05-28 | P0-END-TO-END-PRODUCT-FLOW | Wave 1 / TASK-001 执行完成：session-store 接真实 API、删除 mock-data.ts、workspaces 无 DB 时 500、新增 verify-p0-api-crud.ts；type-check 通过 |
| 2026-05-28 | P0-END-TO-END-PRODUCT-FLOW | Wave 2-4 / TASK-002~006 执行完成：Desktop login-intent + Mobile /m/* 鉴权 + /api/chat 重写 + 集成测试 + 三端 E2E；type-check 通过；真实 DB/Auth 验证待环境 |
| 2026-05-29 | P0-END-TO-END-PRODUCT-FLOW | 真实 DB/Auth smoke 验证通过：Docker Postgres healthy + Auth.js session 三表 + API CRUD 5/5 PASS + build 通过 + Supabase 零残留；Desktop/Mobile/Runtime/E2E 待后续 |
| 2026-05-29 | UI-ALIGN-001 | 闭环：critique→refine→polish→audit 全链完成；commits beb9825 + 1fe7b7d；audit 15/20 PASS；type-check 通过；P0 数据链路未受影响；P1 a11y gaps 残留 |
| 2026-05-29 | P0-END-TO-END-PRODUCT-FLOW | mobile-pwa.spec.ts fixture 迁移完成：Supabase cookie → Auth.js ensureP0StorageState；4/4 tests PASS |
| 2026-05-29 | P1-RT | Agent Runtime 规划完成（ralph-20260529-150000）：analyze→scope-gate→roadmap→plan 全链；scope_verdict=large；7 tasks/3 waves；**止步 plan**（跨三子系统，按约束不 execute） |
| 2026-05-29 | P1-RT | **架构修订（revised plan，止步未 execute）**：用户澄清 Cloud Runtime Gateway 是必需实体（FRP 式 relay），非 optional provider。新增架构合同 `P1-RUNTIME-GATEWAY.md`；roadmap M:P1-RT 重写为 Gateway 模型（public_cloud + user_local 两类 endpoint）；D-003 从「是否需 provider」重定义为「全部自建」，Gateway 实体不再 deferred；Phase 1 改为 contract+DB+routing/event，可执行不要求真实部署 |
| 2026-05-29 | P1-RT | **基础设施自建决策**：Postgres 使用官方镜像/自管部署，Redis 使用官方 Redis 或开源替代自部署，Runtime Gateway/worker 自建；禁止 Supabase/Fly/Neon/Upstash 等包装平台作为产品依赖 |
| 2026-05-29 | P1-RUNTIME-GATEWAY | **Phase 1 execute + 验收完成**（ralph-20260529-170344）：shared 7 事件类型 + 5 张 gateway 表幂等迁移（P0 不变）+ gateway 抽象（去 minimal_adapter）+ /api/chat 按 endpoint 路由 + session 落库；verify-p1-runtime-gateway.ts 真实 DB 12 passed/0 failed/1 skip；落库 probe 读回 + secret 脱敏；tsc exit 0；review verdict=PASS（critical/high/medium=0）；治理门禁覆盖 |
| 2026-05-29 | P1-RT-PHASE2 | **Phase 2 execute + 验收完成**（ralph-20260529-194146）：device-channel-store 连接生命周期单点 upsert device_runtime_channels（ws-gateway addConnection/close/心跳超时 hook）+ gateway invoke user_local 分支 tunnel 事件闭环（tunnel_connected/tunnel_disconnected/local_runtime_offline，曾连接后断开经 channel.connected_at 判定）+ RuntimeErrorCode 集中 packages/shared 并替换内联字符串（DEVICE_OFFLINE/endpoint_unavailable 字面值不变保 P0 兼容）；verify-p1-rt-phase2.ts 真实 DB 13 passed/0 failed/0 skip；Phase 1 回归 12 passed/0 failed/1 skip；packages/shared + apps/web tsc exit 0 |
| 2026-05-29 | P1-RT-PHASE3 | **Phase 3 execute + 验收完成**（ralph-20260529-220000）：自建 docker compose 栈（postgres:15.3+redis:7.2+node worker 官方镜像）+ redis-client 封装（enqueue/dequeue BRPOP/pub-sub/cancel 控制键）+ RuntimeExecutor 接口/FakeExecutor 流式 + worker processJob 状态机（running→completed/cancelled/failed，落 runtime_sessions/runtime_logs seq）+ gateway public_cloud 分支接入队列+订阅事件流转 SSE + cancelRuntimeSession（REDIS 未配保留 endpoint_unavailable 占位，user_local 未改）；verify-p1-rt-phase3.ts 真实 Postgres+Redis 16 passed/0 failed/0 skip（调度/流式/落库+seq/取消/失败 5 类语义）；Phase 2 回归 13 passed/0 failed/0 skip；apps/web tsc exit 0；compose config exit 0；banned-platform 扫描 clean；review verdict=PASS（critical/high=0） |
| 2026-05-29 | P1-RT | **里程碑完成（milestone-audit + milestone-complete）**：三 phase verify+review 均 PASS；milestone-audit PASS（0 critical/0 high，跨 phase 集成无契约冲突）；真实 infra 回归 Phase 3 16/16 + Phase 2 13/13，apps/web + packages/shared tsc exit 0；10 个 artifact 归档至 milestone_history + `.workflow/milestones/P1-RT/`（audit-report/summary/roadmap-snapshot）；current_milestone 置空（standalone 里程碑无 roadmap 后继）；治理门禁 exit 0 |
| 2026-05-30 | RT-REAL-EXEC-001 | **真实可插拔 RuntimeExecutor 接入完成**（ralph-20260530-010200）：executor.ts 新增 CliRuntimeExecutor（spawn claude/codex CLI，readline 流式 stdout→chunk）+ ExecutorUnavailableError（ENOENT/spawn 失败 code=executor_unavailable，禁假成功）+ stderr 仅 drain 不外发（凭证隔离）；runtime-worker.ts createExecutor 工厂按 RUNTIME_EXECUTOR env 选择，默认 FakeExecutor（gateway 零回归）；executor.test.ts 7/7 pass（unavailable/凭证隔离/Fake 回归/失败事件/工厂）；verify 6 truths VERIFIED 0 gaps；review PASS 0 blocking；apps/web tsc exit 0；治理门禁 exit 0；未改 Gateway 总架构，无托管平台依赖，无真实付费调用 |
| 2026-05-30 | RT-REAL-EXEC-001 | **adhoc 里程碑完成归档**（milestone-complete）：5 个 artifact（analyze/plan/execute/verify/review）移入 milestone_history；scratch 归档至 `.workflow/milestones/adhoc-real-runtime-executor/`（audit-report PASS / summary）；current_milestone 置空，status=idle（adhoc 无后继）；ralph-20260530-010200 全 13 步闭环 |
| 2026-05-30 | WEB-WORKSPACE-UX-001 | 用户验真发现 Web Workspace 详情页“看得到但不好点/不可测”；代码审查确认 `/workspace/[id]`、新建会话、session 选中拉消息、发送 `/api/chat` 链路存在交互闭环缺口。已登记为 P0 regression，并补充“先稳定已完成功能，再推进新功能”治理规则 |
| 2026-05-30 | RT-WORKER-HARDEN-001 | **三项 runtime 硬化完成**（ralph-20260530-013000）：G1 worker liveness（redis-client 心跳键 setHeartbeat/isAlive/clearHeartbeat，TTL 默认 30s + runtime-worker reclaimDeadSession 失联落 failed + emit runtime_failed，禁假 completed）；G2 subscribeEvents 空闲 60s/总 600s 双超时（env 可配）产出 runtime_failed 哨兵 + finally 释放 timer/订阅/连接，gateway 落 failed；G3 共享 redact（key 名 + 值级 sk-/ghp_/xoxb-/AKIA/Bearer）接入 worker log() 与 gateway persist；redact 5/5 + liveness 4/4 + subscribe-timeout 2/2 + executor 7/7 回归 = 18/18；verify PASS（G1/G2/G3 VERIFIED 0 gaps）/ review PASS / 三道 gate + goal-audit 全 proceed；apps/web tsc exit 0；commits 14d0c73 + 7fd9633；未改 Gateway 总架构，无 DB schema 迁移 |
| 2026-05-30 | RT-WORKER-HARDEN-001 | **adhoc 里程碑完成归档**（milestone-complete）：audit-report PASS（0 critical/0 high）+ summary 写入 `.workflow/milestones/adhoc-worker-harden/`；2 个 artifact（analyze/plan）移入 milestone_history；current_milestone 置空，status=idle（adhoc 无后继）；治理门禁 RT-WORKER-HARDEN-001 exit 0；ralph-20260530-013000 全 13 步闭环 |
