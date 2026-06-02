# COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02: 完整多 Agent 编排与交接共享合同

> 本合同是 Trellis 与 Maestro/Ralph 的共享事实接口。实现、测试、验收和执行报告都必须引用本文件。

---

## 1. 元信息

| 字段 | 内容 |
| --- | --- |
| TASK-ID | `COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02` |
| 优先级 | `P1 product-completion` |
| 绑定 FR-ID | FR-AGENT-001, FR-ORCH-001, FR-RUNTIME-001, FR-CTX-001, FR-ACTION-001, FR-WEB-001, FR-DESK-001, FR-MOB-001 |
| 来源 | `research/prd.md`, `research/technical-design.md`, `research/contracts/P1-RUNTIME-GATEWAY.md`, `research/contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md`, `.trellis/spec/cross-layer/runtime-gateway-contract.md` |
| Trellis 任务 | `.trellis/tasks/06-02-complete-multi-agent-orchestration` |
| 负责人角色 | Codex 控制流程；Trellis 管实现规范；Maestro/Ralph 可用于大范围执行 |
| 状态 | `completed-finalized-2026-06-03` |

---

## 2. 背景与目标

当前代码已经证明“单机自建 Postgres/Redis + Web cloud worker + Claude Code/Codex CLI + Role Agent runtime binding + native session resume + durable mailbox/handoff/recovery”这条 canonical 线路可跑。2026-06-03 最终补全后，首轮多角色 `/api/chat` 执行通过共享 runtime-node dispatcher 创建 runtime session、更新 attempt/mailbox/plan node、订阅后投递带 `planNodeId`、`attemptId`、`mailboxItemId` 的 worker job；首轮节点 attempt/mailbox 从 `queued` 开始并由真实 runtime 终态回写；Web 编排面板读取 timeline API 展示 attempt/mailbox/runtime session/log evidence。

最终目标是：同一个 AgentHub session 内，用户可以配置多个中文角色，每个角色独立绑定 Claude Code 或 Codex；Orchestrator 自动或半自动分解任务，按角色并发/串行调度，等待需要等待的节点，执行 fan-out/fan-in，保留每个角色的 native session 与上下文交接，并在 Web/Desktop/Mobile 三端呈现计划、状态、审批、产物和失败恢复。

本合同不要求兼容旧 mock/fallback 线路。必要时 acceptance 数据可 drop/reseed。当前 canonical 线路是：自建 Postgres、Redis、Web Gateway/worker、Claude Code/Codex CLI、Auth.js DB session、Role Agent 配置。后续实现必须直接落当前 canonical contract；旧字段、旧标签、旧 fake/script 主链路只允许在一次性迁移、负向测试或历史说明中出现。

---

## 3. 当前完成状态

| 能力 | 当前状态 | 验收结论 |
| --- | --- | --- |
| Orchestrator DAG | `/api/chat` 根据选中 orchestrator/workers 生成 durable plan/nodes；根据任务关键词支持后端/schema/API 节点先行，worker fan-out/fan-in，summarizer 汇总，失败传播。 | 当前 canonical 线路完成；复杂 LLM 规划器和可视化 DAG 编辑器不纳入本合同范围。 |
| 角色选择 | 用户可配置中文角色和 `role_agents.runtime_type`；默认 `架构师` / `前端工程师` / `后端工程师` 可分别绑定 Claude Code/Codex。 | 完成。 |
| Handoff 内核 | `agent_mailbox_items` 与 `plan_node_attempts` 持久化 inbound/reply/dead-letter、attempt lineage、target role、runtime type；首轮执行和 retry/resume 均带 durable attempt/mailbox evidence。 | 完成。 |
| Session 连续性 | runtime session 复用 scope 固定为 `(session_id, role_agent_id, runtime_type, cwd)`；Codex/Claude Code native session id 会在 retry/resume/direct runtime 中复用。 | 完成。 |
| Plan 恢复 | 已有 plan node `retry/resume/cancel/requeue` API；resume 创建新 attempt/mailbox，`dispatch-ready` 投递真实 runtime，parent plan 重新推进。 | 完成。 |
| Worker 调度 | Worker 按 job `runtimeType` 选择 Claude Code/Codex；fake/script 仅测试授权；不可用时明确失败，不 fallback。 | 完成。 |
| UI 工作台 | Web 编排面板显示节点状态、控制按钮和 timeline evidence：role/runtime、attempt/mailbox/runtime session/native session/log count；Mobile/PWA 展示计划监督和 retry/resume；Desktop 展示 runtime inventory、角色 runtime health、native session 续接。 | 完成当前产品面；更复杂 DAG 编辑器不在范围内。 |
| 验收 | Phase 5 真实 Claude+Codex UAT、recovery UAT、三端截图、unit/type-check 已记录；2026-06-03 追加首轮 durable evidence 透传和 Web timeline evidence 测试。 | 完成。 |

---

## 4. 用户链路合同

1. 用户启动 canonical 环境：`pnpm env:acceptance:up` 与 `pnpm dev:acceptance`，机器已安装并登录 Claude Code 和 Codex。
2. 用户进入 Web workspace，打开角色面板，看到中文默认角色：`架构师`、`前端工程师`、`后端工程师`，每个角色显示绑定 runtime 和可用性。
3. 用户为前端角色选择 Claude Code，为后端角色选择 Codex，保存后刷新仍持久。
4. 用户在同一个 session 中提交复杂任务。
5. Orchestrator 生成计划 DAG：规划节点、前端节点、后端节点、汇总节点；需要等待时节点进入 waiting/blocked，而不是静默跳过。
6. Cloud worker 按节点 runtimeType 调用对应 CLI；每个角色复用自己的 native session id。
7. 前端和后端角色收到只属于自己的 handoff/context；summarizer 收到 planner 与 worker 输出后汇总。
8. 用户在 Web timeline 看到节点运行、等待、失败、重试、完成状态；Mobile/PWA 可监督审批；Desktop 显示本机 runtime inventory。
9. 刷新页面后，plan、nodes、messages、runtime_sessions、runtime_logs、handoffs、artifacts 全部可恢复。
10. 任一节点失败时，用户可重试该节点或继续 plan；系统不切换到其他 runtime，不写 fake success。

---

## 5. 三端职责边界

| 端 | 职责 | 不做什么 |
| --- | --- | --- |
| Web | 主工作台；角色配置；Orchestrator timeline；handoff 查看；retry/resume/cancel；artifact/diff/approval | 不直连本地 IP/port；不把 runtime 不可用渲染成成功 |
| Desktop | 本机 Claude/Codex inventory；CLI auth/launch/native session doctor；本地 runtime tunnel；本地通知 | 不作为 Web 数据真相源；不伪造 cloud worker 可用 |
| Mobile/PWA | 远程监督；计划状态查看；审批；artifact 预览 | 不承载复杂角色配置和编排编辑 |

---

## 6. 数据与后端合同

- Role Agent：`role_agents.runtime_type` 是唯一 runtime binding，允许 `claude_code|codex`，禁止 `capabilities` runtime tag。
- Runtime Session：必须记录 `session_id`、`role_agent_id`、`runtime_type`、`cwd`、`native_session_id`、`capability_snapshot`。
- Plan/Node：`plans` 与 `plan_nodes` 是 durable DAG 真相源；`runtime_invoke` 节点不依赖 shell command/action row。
- Mailbox/Handoff：完整实现应新增或扩展 durable handoff/inbox/attempt/reply 结构，保证每个 agent 入站串行、reply 回流、retry lineage。
- API：需要 plan node 级 retry/resume/cancel/requeue；需要 runtime inventory/status API；需要 handoff 查看 API。
- 错误语义：runtime 未安装、未登录、不可启动、worker 不在线、Redis 不一致、native session 不可恢复，都必须用明确中文错误态返回并持久化失败证据。
- 产品运行时允许 mock 主链路数据：否。

---

## 7. 参考项目输入

| 参考项目 | 读取范围 | 提炼内容 | 不采用内容 |
| --- | --- | --- | --- |
| `refer_proj/catlog22__maestro-flow` | `guide/role-routing-guide.md`, `guide/delegate-async-guide.md` | 角色与 CLI 工具解耦；fallback chain 概念；async delegate 生命周期、message injection、resume | 不采用透明 fallback 到其他 runtime；AgentHub 必须按用户角色绑定 runtime 执行 |
| `refer_proj/Lianues__Iris` | `docs/agents.md`, cross-agent tests | Agent 配置分层、独立 session/memory、CrossAgentTaskBoard、delegate | 不复制其全局 agent 目录结构；AgentHub 以 workspace/session/role_agent 为真相源 |
| `refer_proj/SeemSeam__claude_codex_bridge` | `docs/agent-mailbox-kernel-design.md` | mailbox kernel、per-agent inbound serialization、attempt/reply/lineage、fan-out/fan-in | 不引入旧 job 中心模型；不保留 provider 公开路由语义 |
| `refer_proj/shuxueshuxue__ccm-orchestra` | README/AGENTS | persistent agent sessions、orchestra/conductor 思路 | 不直接搬运 CLI UI |
| `refer_proj/catlog22__Claude-Code-Workflow` | orchestration tests/workflow docs | 编排测试、角色 prompt 模板 | 不提交 refer_proj 产物 |

---

## 8. 阶段计划

### Phase 1: 合同与数据内核

- 建立 Agent mailbox/handoff/attempt/reply/lineage 数据模型。
- 定义 plan node retry/resume/cancel/requeue API。
- 定义 runtime inventory/capability API。
- 更新 `.trellis/spec/cross-layer/runtime-gateway-contract.md` 与相关 shared 类型。

### Phase 2: Orchestrator 执行内核

- Orchestrator 根据角色配置生成 DAG，而不是固定 planner/workers/summarizer 模板。
- 实现 per-role inbound serialization：跨角色可并发，同一角色串行。
- 实现 wait-all/fan-in、失败传播、dead-letter、retry lineage。
- 保证 handoff 只注入目标角色。

### Phase 3: Runtime 与 Session 完整续接

- Claude Code 与 Codex 的 native session resume 覆盖 direct chat、plan node、retry、resume。
- Worker machine inventory 支持 Claude/Codex health、auth、launch、concurrency。
- Cancel/interrupt 能回写 runtime session 和 plan node。

### Phase 4: 三端 UI 完整化

- Web timeline 展示 DAG、节点状态、handoff、runtime、retry/resume/cancel。
- Desktop 展示 machine inventory、角色 runtime 可用性、native session 状态。
- Mobile/PWA 展示 plan/handoff/artifact 并完成审批。

### Phase 5: 真实验收与治理

- 真实 Claude + Codex 双 CLI multi-role E2E。
- 浏览器 UAT 覆盖角色配置、计划生成、handoff、refresh persistence、retry/resume。
- 记录 execution report、tracker、ledger、治理门禁。

---

## 9. Trellis 派生要求

- `.trellis/tasks/06-02-complete-multi-agent-orchestration/prd.md` 必须引用本合同。
- `implement.jsonl` / `check.jsonl` 必须包含本合同、runtime gateway spec、real-flow acceptance spec、credential boundary spec、cross-layer/backend/frontend specs。
- 每阶段实现前必须先检查是否需要更新 `.trellis/spec/*`，特别是 runtime/handoff/plan node retry 合同。

---

## 10. 测试与验收合同

自动化测试必须覆盖：

- type-check：root `pnpm type-check`。
- API/integration：role runtime validation、plan DAG creation、mailbox handoff、plan node retry/resume/cancel、runtime inventory、native session reuse。
- Worker：per-job runtime selection、per-role serialization、failed node propagation、parent plan settlement、cancel/interrupt。
- Web E2E：角色配置、multi-role send、plan timeline、handoff visibility、retry/resume、refresh persistence。
- Desktop E2E：machine inventory、CLI auth/launch/native session doctor。
- Mobile/PWA E2E：计划状态、审批、artifact preview。
- 数据库验证：plans/nodes/runtime_sessions/runtime_logs/handoffs/artifacts 刷新后仍一致。

人工验收路径：

1. Drop/reseed acceptance DB。
2. 启动 Web + worker。
3. 配置 `前端工程师=Claude Code`、`后端工程师=Codex`。
4. 发起一个需要前后端协作的任务。
5. 验证 Orchestrator 生成 DAG、worker 并发、handoff 正确、summarizer fan-in。
6. 人为制造一个节点失败，验证 retry/resume 后继续 plan。

---

## 11. 禁止项

- 不允许 fallback 到另一个 runtime 来掩盖角色绑定 runtime 不可用。
- 不允许用 fake/script executor 证明产品主链路。
- 不允许用仅 `toBeVisible` 或 `playwright --list` 作为验收。
- 不允许把 handoff 作为全局 prompt 注入所有角色。
- 不允许覆写旧 attempt；retry 必须保留 lineage。
- 不允许继续把旧 P0 acceptance closure 当成完整多 Agent 产品完成证明。

---

## 12. 完成门禁

- [x] 合同、PRD、tracker、ledger 同步。
- [x] 真实 Claude + Codex CLI E2E/UAT 有证据。
- [x] Web/Desktop/Mobile 主入口均有真实链路验证。
- [x] 所有新增数据结构有迁移/seed/类型/测试。
- [x] `pnpm type-check`、相关 unit/integration/E2E 通过。
- [ ] 治理门禁 `bash scripts/verify-governance-gate.sh COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02` exit 0。

---

## 13. 当前结论

没有发现必须另起一个 refer_proj 没覆盖的未知方案。完整实现需要的核心抽象都可以从现有参考项目提炼，但 AgentHub 需要按自己的产品事实重新落成：workspace/session/role_agent/plan/plan_node/runtime_session/message/artifact/mailbox_attempt 的 durable Web 产品链路。

---

## 14. 统一计划结论（2026-06-02）

本计划不再另建平行大计划，继续使用当前 Trellis 任务和本共享合同作为唯一入口：

- Trellis task：`.trellis/tasks/06-02-complete-multi-agent-orchestration`
- PRD amendment：`research/prd-amendments/2026-06-02-complete-multi-agent-orchestration.md`
- 技术设计：`research/architecture/technical-design.md`
- 跨层契约：`.trellis/spec/cross-layer/runtime-gateway-contract.md` 与 `.trellis/spec/cross-layer/real-flow-acceptance.md`
- 公开进度：`research/project-tracker.md`
- 未完成项台账：`research/regression-ledger.md`

当前结论：

1. 不需要 refer_proj 之外的新未知方案。参考项目已经覆盖角色路由、异步 delegate、task board、mailbox kernel、persistent sessions、fan-out/fan-in 和 retry lineage。
2. 需要 AgentHub 自身落地。缺口不是外部方案，而是 schema/API/worker/UI/UAT 的 durable 产品实现深度。
3. 不做兼容性分支。旧 mock、旧 runtime tag、旧 fake executor、旧 plan/action 入口不得继续作为产品路径保留。必要时 acceptance 数据 drop/reseed。
4. 不一次性要求全部完成。允许按 Phase 1-5 逐步实现，但每个阶段必须交付可验证的 canonical 行为，不能用“基础能跑”替代最终目标。

---

## 15. 最终完整实现分阶段执行计划

### Phase 1: 数据内核、API 合同与 no-compat schema

目标：先建立最终产品的 durable truth，不继续扩展旧 metadata-only handoff。

交付物：

- 新增或等价扩展 mailbox/handoff 数据内核：outbound message、inbound message、handoff attempt、reply event、lineage/parent attempt、dead-letter 或 failed inbox 状态。
- 明确每个 Role Agent 入站串行消费，同一 session 下跨角色可以并行。
- 明确 plan node attempt 模型：retry/resume/cancel/requeue 必须保留旧 attempt 证据。
- 定义 plan node 控制 API：`POST /api/plan-nodes/:id/retry`、`POST /api/plan-nodes/:id/resume`、`POST /api/plan-nodes/:id/cancel`、`POST /api/plan-nodes/:id/requeue`。
- 定义 runtime inventory/status API：machine-wide Claude Code/Codex availability、auth status、launchability、capability snapshot、per-role selected runtime health。
- 更新 acceptance schema、shared types、database types、seed/bootstrap。
- 删除或拒绝旧兼容入口：runtime tag routing、fake/script product executor、old payload fallback。

验收：

- migration/bootstrap 可 drop/reseed acceptance DB。
- API/unit 测试证明旧 runtime tag 不参与路由。
- mailbox/attempt/reply/lineage 数据可写入、查询、按 target role 过滤。
- plan node retry 创建新 attempt，不覆盖旧 runtime/session/log evidence。

### Phase 2: Orchestrator 动态 DAG 与 mailbox 调度内核

目标：把固定 planner/workers/summarizer 模板升级为可解释、可恢复的动态 DAG。

交付物：

- Orchestrator 根据用户任务、角色配置、runtime health、依赖关系生成 Plan DAG。
- DAG validator 覆盖 cycle、missing dependency、role ownership、role runtime availability、waiting/blocked、failure propagation、retry limit。
- Scheduler 支持 ready wave、wait-all fan-in、per-role inbound serialization、cross-role parallel dispatch、upstream failure blocking downstream。
- Handoff 只注入目标角色 prompt，不进入全局 prompt。
- Reply 回流为 durable event，再由 Orchestrator 或后续节点消费。

验收：

- 一个复杂任务生成 planner、前端 worker、后端 worker、summarizer 之外可扩展的 durable DAG。
- 前端/后端按依赖并发或串行执行；同一角色永远串行消费。
- 失败节点会阻塞下游，UI/API 可读原因。

### Phase 3: Runtime、native session 与恢复执行

目标：让 Claude Code/Codex 的角色级 native session continuity 覆盖 direct chat、plan node、retry、resume。

交付物：

- Runtime session reuse scope 固定为 `(session_id, role_agent_id, runtime_type, cwd)`。
- Worker job 必须按 `role_agents.runtime_type` 调度，不 fallback。
- Claude Code/Codex resume 参数和 native session id 解析以当前本机 CLI 验证为准。
- retry/resume/direct chat/after-complete message injection 全部复用对应 role/runtime/cwd 的 native session。
- cancel/interrupt 写入 runtime session、runtime log、plan node attempt。
- Runtime unavailable/auth-required/not-launchable 写入明确中文错误态和 durable evidence。

验收：

- 同一个 session 内 `前端工程师=Claude Code`、`后端工程师=Codex` 分别复用自己的 native session。
- retry/resume 不创建错误 role/runtime/cwd 的 native session。
- 选定 runtime 不可用时失败，不切换到另一个 CLI。

### Phase 4: Web/Desktop/Mobile 三端产品面

目标：把 durable DAG、handoff、runtime inventory 和失败恢复变成可操作产品界面。

Web：

- DAG timeline：节点、依赖、wave、状态、等待、失败、完成。
- Node detail：prompt/context/handoff/attempt/runtime logs/artifacts。
- Controls：retry/resume/cancel/requeue。
- Role runtime health：每个中文角色显示绑定 runtime、native session、可用性。

Desktop：

- Machine inventory：Claude Code/Codex path/version/auth/launch/capability。
- Native session doctor：role/runtime/cwd 维度的 resume 状态。
- Gateway/worker/DeviceChannel 状态与修复入口。

Mobile/PWA：

- Plan/handoff/runtime 只读监督。
- 审批、retry/resume 关键控制。
- Artifact 预览和刷新持久化。

验收：

- 三端从真实 API 读取同一 plan/node/mailbox/runtime/artifact 状态。
- 刷新后状态一致；没有假空态、旧入口或 mock route 通过。

### Phase 5: 真实 Claude+Codex UAT 与治理收口

目标：证明最终完整多 Agent 产品链路完成，而不是只证明基础 runtime 可跑。

自动化验收：

- `pnpm type-check`
- shared/domain tests
- web API/runtime/orchestrator tests
- worker tests
- Web E2E
- Desktop E2E 或 opencli/Electron UAT
- Mobile/PWA E2E
- governance gate：`bash scripts/verify-governance-gate.sh COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02`

真实人工/UAT：

1. Drop/reseed acceptance DB。
2. 启动 `pnpm env:acceptance:up` 与 `pnpm dev:acceptance`。
3. 确认机器已安装并登录 Claude Code 与 Codex。
4. 在 Web 配置 `前端工程师=Claude Code`、`后端工程师=Codex`。
5. 发起前后端协作任务。
6. 验证 durable DAG、handoff、worker 并发、native session 复用、artifact 产出。
7. 人为制造一个节点失败。
8. 在 UI/API retry/resume 后继续 parent plan。
9. Web/Desktop/Mobile 刷新后读到一致状态。

---

## 16. 最终补全记录（2026-06-03）

2026-06-03 根据用户“需要完全实现”的要求补齐此前审计发现的最后两个产品深度缺口：

- 首轮 `/api/chat` 多角色执行不再只创建 evidence 后在 request-local 内存 wave 中推进；每个首轮节点会创建 `queued` attempt/mailbox，并调用共享 runtime-node dispatcher 创建 runtime session、更新 attempt/mailbox/plan node、订阅后投递带 `planNodeId`、`attemptId`、`mailboxItemId` 的 Runtime worker job。真实 worker 终态直接回写同一 durable evidence。
- 首轮 mailbox context 写入接收到的 handoff 列表，Web timeline API 证据进入 OrchestratorPanel，PlanCard 展示角色名/runtime、attempt/mailbox/runtime session/native session/log count。

补充验证：

- `pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/api/plan-node-controls-inventory.test.ts __tests__/runtime/executor.test.ts --run` PASS（3 files / 38 tests）。
- `pnpm --filter @agenthub/shared test -- --run` PASS（5 files / 31 tests）。
- `pnpm --filter @agenthub/web type-check` PASS。

P0 acceptance closure 仍只作为 canonical baseline；完整多 Agent 完成结论以本合同、Phase 5 UAT、2026-06-03 最终补全报告、tracker、ledger 和治理门禁为准。
