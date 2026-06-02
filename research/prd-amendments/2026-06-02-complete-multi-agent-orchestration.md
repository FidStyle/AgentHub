# 完整多 Agent 编排与交接修订

**日期：** 2026-06-02  
**状态：** planning-contract-v2  
**触发任务：** `.trellis/tasks/06-02-complete-multi-agent-orchestration/`  
**共享合同：** `research/contracts/COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02.md`  
**影响 FR-ID：** `FR-AGENT-001`, `FR-ORCH-001`, `FR-RUNTIME-001`, `FR-CTX-001`, `FR-ACTION-001`, `FR-WEB-001`, `FR-DESK-001`, `FR-MOB-001`  
**相关文档：** `research/prd.md`, `research/contracts/P1-RUNTIME-GATEWAY.md`, `.trellis/spec/cross-layer/runtime-gateway-contract.md`

---

## 1. 触发原因

P0 acceptance closure 已经证明当前 canonical 线路可用：自建 Postgres/Redis、Web Gateway/runtime worker、Claude Code/Codex CLI、Role Agent runtime binding、基础 native session resume 和基础 ContextPackage handoff。

但用户明确要求按“最终完整实现”重新判断，不需要保留旧 mock/fallback 兼容，只保证当前 canonical 线路可用，必要时数据可 drop/reseed。因此需要把“当前 P0 可验收”与“完整多 Agent 产品能力”分开记录。

---

## 2. 修订后的产品目标

AgentHub 的完整多 Agent 目标是：

1. 用户在同一 session 中配置多个中文角色，例如 `架构师`、`前端工程师`、`后端工程师`。
2. 每个角色独立绑定 Claude Code 或 Codex。
3. Orchestrator 根据用户任务生成可解释 DAG，包含依赖、并发、等待、汇总、失败传播和重试策略。
4. 角色之间通过 durable handoff/mailbox 交接上下文，而不是把所有历史塞进全局 prompt。
5. 每个角色复用自己的 native CLI session；retry/resume/direct chat/plan node 都遵守同一 session scope。
6. Web/Desktop/Mobile 三端展示一致的 plan、node、handoff、runtime、approval、artifact 状态。

---

## 3. 需要补强的 PRD 语义

### 3.1 Orchestrator

原 PRD 已要求 Orchestrator 计划与分派。完整实现进一步要求：

- 计划不是固定模板；必须由任务、角色配置、runtime 可用性和依赖关系共同决定。
- 计划节点必须 durable，可在刷新后恢复。
- 等待、失败、retry、resume、cancel 是产品行为，不是后端内部状态。

### 3.2 Handoff

原 PRD 已要求 Context Package。完整实现进一步要求：

- handoff 是目标 Role Agent 的入站上下文，不是全局 prompt 附加文本。
- handoff 必须有来源、目标、phase、runtime、source message、attempt lineage。
- reply 必须回流为 durable event，再进入 Orchestrator 或目标角色的后续输入。

### 3.3 Runtime Binding

原 PRD 已收敛 Claude Code/Codex。完整实现进一步要求：

- 角色 runtime binding 是硬约束。选中 Codex 的角色不能因 Codex 不可用自动切到 Claude。
- worker 是 machine-wide inventory，可运行机器上所有可用 Claude/Codex，但每个 job 必须按 role runtimeType 调度。
- Desktop 需要展示本机 CLI inventory、auth、launch、native session 状态。

### 3.4 三端

- Web 是完整 orchestration workbench。
- Desktop 是 runtime host/inventory/doctor，不替代 Web timeline。
- Mobile/PWA 是监督、审批、artifact 预览和轻量控制端。

---

## 4. 当前不是卡点的事项

没有发现 refer_proj 之外必须另行发明的未知方案。

可参考并吸收：

- Maestro Flow：角色路由、异步 delegate、message injection、resume。
- Iris：多 Agent 配置分层、CrossAgentTaskBoard。
- Claude Codex Bridge：mailbox kernel、per-agent inbound serialization、attempt/reply/lineage、fan-out/fan-in。

AgentHub 的工作是把这些抽象落成自身的数据模型和真实三端产品链路。

---

## 5. 明确不做

- 不保留旧 fake/script 产品线路。
- 不允许 runtime fallback 掩盖角色绑定失败。
- 不引入 Claude/Codex 之外的新 runtime。
- 不把参考项目代码作为提交产物。
- 不把 P0 acceptance closure 视为完整多 Agent 产品完成证明。

---

## 6. 合并记录

- draft：2026-06-02，根据用户“必须完整、不需要兼容、参考 refer_proj 不算卡点”的要求创建。
- planning-contract-v2：2026-06-02，统一为现有 `COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02` 计划，不另建平行大计划；补齐 Phase 1-5 最终实现路线、no-compat/drop-reseed 口径、mailbox/attempt/reply/lineage、动态 DAG、plan node retry/resume/cancel、runtime inventory、三端 UI 和真实 Claude+Codex UAT。
- merged：待后续实现阶段同步到 `research/prd.md` 的 FR 细项或保持 amendment 作为长期修订入口。

---

## 7. 最终完整实现路线

本 amendment 的后续实现以共享合同 `research/contracts/COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02.md` 为权威。当前不再新增平行计划，统一更新现有 Trellis task、技术设计、跨层契约、tracker 和 ledger。

### Phase 1：数据内核、API 合同与 no-compat schema

- 建立 mailbox/handoff durable 内核：outbound、inbound、attempt、reply、lineage、dead-letter。
- 建立 plan node attempt 与 retry/resume/cancel/requeue API。
- 建立 runtime inventory/status API，覆盖 Claude Code/Codex health、auth、launch、capability snapshot。
- acceptance schema/shared types/database types/seed/bootstrap 同步更新。
- 旧 runtime tag、fake/script product executor、old payload fallback 不再作为产品路径保留；必要时 drop/reseed acceptance 数据。

### Phase 2：Orchestrator 动态 DAG 与 mailbox 调度

- Orchestrator 按用户任务、角色配置、runtime health、依赖关系生成可解释 DAG。
- validator 覆盖 cycle、missing dependency、role ownership、runtime availability、waiting/blocked、failure propagation、retry limit。
- scheduler 支持 ready wave、wait-all fan-in、同角色串行、跨角色并发。
- handoff 只注入目标角色 prompt；reply 以 durable event 回流。

### Phase 3：Runtime、native session 与恢复执行

- direct chat、plan node、retry、resume 统一按 `(session_id, role_agent_id, runtime_type, cwd)` 复用 native session。
- worker job 必须按 `role_agents.runtime_type` 调度；runtime 不可用时明确失败，不 fallback。
- cancel/interrupt 写入 runtime session、runtime log 和 plan node attempt。

### Phase 4：Web/Desktop/Mobile 三端产品面

- Web 显示 DAG timeline、node detail、handoff、attempt、runtime logs、retry/resume/cancel/requeue。
- Desktop 显示 machine inventory、CLI auth/launch、native session doctor、Gateway/worker/DeviceChannel 状态。
- Mobile/PWA 支持 plan/handoff/runtime 监督、审批、关键 retry/resume 和 artifact 预览。

### Phase 5：真实 Claude+Codex UAT 与治理

- 使用 canonical acceptance 环境和真实 Claude Code/Codex CLI。
- 覆盖角色配置、动态 DAG、handoff、native session 复用、失败注入、retry/resume、刷新持久化和三端一致状态。
- 完成 execution report、tracker、ledger 和治理门禁。
