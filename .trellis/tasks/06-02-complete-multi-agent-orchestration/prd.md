# 最终完整多 Agent 编排与交接

## Goal

把当前可跑的 AgentHub cloud runtime 线路推进到完整多 Agent 产品形态：同一个 session 中，中文角色可各自绑定 Claude Code 或 Codex，由 Orchestrator 生成并执行可恢复 DAG，角色之间通过 durable handoff/mailbox 交接上下文，Web/Desktop/Mobile 能查看、审批、重试、恢复和验证真实执行结果。

共享合同：`research/contracts/COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02.md`

统一口径：本任务是现有 P1 完整产品能力计划，不再另建平行计划；旧 mock/fallback/compat 路径不进入产品完成范围。必要时 acceptance 数据可 drop/reseed，只保证当前 canonical 线路可用。

## What I already know

* 当前 P0 acceptance closure 已证明 canonical 线路可跑：Postgres/Redis/Auth.js session/Web Gateway/runtime worker/Claude Code/Codex CLI。
* `role_agents.runtime_type` 已成为 runtime 绑定字段，默认中文角色包括 `架构师`、`前端工程师`、`后端工程师`。
* `runtime_sessions` 已记录 role/runtime/cwd/native session，并按 scope 复用 native session id。
* `/api/chat` 已支持 orchestrator+workers 创建 durable `plans`/`plan_nodes`，并持久化基础 `ContextPackage` handoff。
* `runtime_invoke` plan node 已可通过 plan confirm 投递 runtime worker，worker 可回写无 actionId 的 plan node 并结算父 plan。
* 完整实现仍缺 Orchestrator 深度决策、mailbox/attempt/reply/lineage 内核、计划节点 retry/resume/cancel、真实双 CLI 多角色 UAT、三端完整 timeline 和 runtime inventory。

## Assumptions

* 不保持旧 mock/fallback 兼容；当前 canonical 线路可 drop/reseed 数据。
* 只覆盖 Claude Code 与 Codex，不主动引入 opencode/Gemini 等额外 runtime。
* 用户角色配置中的 runtime binding 是硬约束；runtime 不可用时失败，不自动切换。
* refer_proj 只作为规则输入，不提交或复制其产物。

## Requirements

* Role Agent:
  * 所有角色用中文默认描述。
  * 每个角色显式绑定 `claude_code` 或 `codex`。
  * UI 显示 role runtime health 和 native session 状态。
* Orchestrator:
  * 根据用户任务和角色配置生成 DAG。
  * 支持 planner、worker、summarizer 之外的可扩展节点，但当前实现先服务前端/后端/架构师协作。
  * 支持等待、并发、fan-in、失败传播。
* Handoff:
  * 使用 durable mailbox/task-board 模型表达出站、入站、attempt、reply、lineage。
  * 每个角色入站串行消费，跨角色可并发。
  * handoff 只注入目标角色 prompt。
* Runtime:
  * Worker machine inventory 包含 Claude Code/Codex 可用性、auth、launch、capability snapshot。
  * direct chat、plan node、retry、resume 都复用同一角色 native session。
  * 不可用时明确失败，不 fallback。
* Plan recovery:
  * 新增 plan node 级 retry/resume/cancel/requeue API。
  * retry 保留 attempt lineage，不覆盖旧执行证据。
  * resume 继续 parent plan，并能补跑 blocked/summarizer 节点。
* UI:
  * Web 主工作台显示 DAG timeline、节点状态、handoff、runtime、retry/resume/cancel。
  * Desktop 显示本机 CLI inventory、auth/launch/native session doctor。
  * Mobile/PWA 支持计划监督、审批和 artifact 预览。

## Acceptance Criteria

* [ ] 用户可在 Web 配置 `前端工程师=Claude Code`、`后端工程师=Codex` 并刷新持久。
* [ ] 一个 session 中复杂任务生成 durable DAG，至少包含 planner、前端 worker、后端 worker、summarizer。
* [ ] 前端/后端 worker 按各自 runtime 并发或按依赖执行，且同一角色串行。
* [ ] Handoff 只进入目标角色 prompt，消息 metadata 和 handoff 表可查。
* [ ] Claude Code 与 Codex 的 native session id 在 retry/resume/direct chat 中按 role/runtime/cwd 复用。
* [ ] 任一 node 失败后，可通过 UI/API retry/resume 并继续 parent plan。
* [ ] Web/Desktop/Mobile 三端能从真实入口看到一致状态。
* [ ] 真实 Claude + Codex CLI UAT 通过，不使用 fake/script executor。
* [ ] Drop/reseed acceptance DB 后，schema/seed/shared types/API/UI 仍按 canonical contract 工作，无旧 runtime tag/fallback 路由。

## Definition of Done

* 合同、PRD、tracker、ledger、execution report 同步。
* Schema、shared types、API、worker、UI、tests 一致。
* `pnpm type-check` 通过。
* 相关 API/unit/integration/E2E/UAT 通过。
* 治理门禁通过。

## Out of Scope

* 不引入 Claude/Codex 之外的新 runtime。
* 不做托管平台选型；继续自建 Postgres/Redis/Web worker。
* 不兼容旧 fake/script 产品线路。
* 不把 refer_proj 代码作为提交产物。

## Phased Implementation Plan

### Phase 1: 数据内核、API 合同与 no-compat schema

* 建立 mailbox/handoff durable 内核：outbound、inbound、attempt、reply、lineage、dead-letter。
* 建立 plan node attempt 模型和 `retry/resume/cancel/requeue` API。
* 建立 runtime inventory/status API，覆盖 Claude Code/Codex health、auth、launch、capability snapshot 和 per-role selected runtime health。
* 更新 `docker/postgres/acceptance-schema.sql`、`packages/shared`、database types、seed/bootstrap。
* 删除或拒绝旧 runtime tag routing、fake/script product executor、old payload fallback。
* 验收：API/unit 测试证明 mailbox target filtering、attempt lineage、旧 runtime tag 不参与路由、retry 不覆盖旧证据。

### Phase 2: Orchestrator 动态 DAG 与 mailbox 调度内核

* Orchestrator 根据任务、角色配置、runtime health、依赖关系生成 Plan DAG。
* DAG validator 覆盖 cycle、missing dependency、role ownership、runtime availability、waiting/blocked、failure propagation、retry limit。
* Scheduler 支持 ready wave、wait-all fan-in、同角色入站串行、跨角色并发。
* Handoff 只注入目标角色 prompt；reply 以 durable event 回流给 Orchestrator 或后续节点。
* 验收：复杂任务生成 durable DAG；前端/后端角色按依赖并发或串行；失败节点阻塞下游且 UI/API 可读原因。

### Phase 3: Runtime、native session 与恢复执行

* `runtime_sessions` 复用范围固定为 `(session_id, role_agent_id, runtime_type, cwd)`。
* direct chat、plan node、retry、resume、after-complete message injection 全部复用对应 role/runtime/cwd native session。
* Worker job 必须按 `role_agents.runtime_type` 调度；runtime 不可用、未登录、不可 launch 时明确失败，不 fallback。
* cancel/interrupt 写入 runtime session、runtime log、plan node attempt。
* 验收：同 session 中 `前端工程师=Claude Code`、`后端工程师=Codex` 分别复用自己的 native session。

### Phase 4: Web/Desktop/Mobile 三端产品面

* Web：DAG timeline、node detail、handoff viewer、attempt/runtime logs、retry/resume/cancel/requeue controls、角色 runtime health。
* Desktop：machine inventory、CLI auth/launch/native session doctor、Gateway/worker/DeviceChannel 状态与修复入口。
* Mobile/PWA：plan/handoff/runtime 监督、审批、关键 retry/resume、artifact 预览。
* 验收：三端从真实 API 读取同一 plan/node/mailbox/runtime/artifact 状态，刷新后仍一致。

### Phase 5: 真实 Claude+Codex UAT 与治理收口

* Drop/reseed acceptance DB。
* `pnpm env:acceptance:up` + `pnpm dev:acceptance`。
* Web 配置 `前端工程师=Claude Code`、`后端工程师=Codex`。
* 发起前后端协作任务，验证 durable DAG、handoff、worker 并发、native session 复用、artifact。
* 人为制造节点失败，验证 UI/API retry/resume 后继续 parent plan。
* 跑 `pnpm type-check`、相关 unit/integration/E2E、execution report、tracker、ledger、governance gate。

## Technical Notes

* 合同：`research/contracts/COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02.md`
* Runtime spec：`.trellis/spec/cross-layer/runtime-gateway-contract.md`
* Real-flow spec：`.trellis/spec/cross-layer/real-flow-acceptance.md`
* Technical design：`research/architecture/technical-design.md`
* Orchestrator modules：`research/modules/orchestrator.md`、`research/modules/orchestrator-plan-dag.md`
* 当前核心代码：`apps/web/app/api/chat/route.ts`、`apps/web/lib/runtime/gateway.ts`、`apps/web/server/runtime-worker.ts`、`apps/web/lib/orchestrator/action-dispatcher.ts`
* 参考调研：`.trellis/tasks/06-02-complete-multi-agent-orchestration/research/reference-multi-agent-patterns.md`
