# Reference Multi-Agent Patterns

## Summary

当前没有需要脱离 refer_proj 另行发明的未知方案。完整实现需要把多个参考项目的成熟抽象合并到 AgentHub 自己的 durable Web 产品链路中。

## Referenced Inputs

### Maestro Flow

Files:

* `refer_proj/catlog22__maestro-flow/guide/role-routing-guide.md`
* `refer_proj/catlog22__maestro-flow/guide/delegate-async-guide.md`

Useful rules:

* Role describes capability, tool/runtime is configured separately.
* Async delegate has durable lifecycle: queued, running, completed, failed, cancelled, input_required.
* Message injection and resume are first-class operations.

AgentHub adaptation:

* Keep role/runtime binding explicit on `role_agents.runtime_type`.
* Do not use fallback chains as product execution behavior. AgentHub can use inventory to show alternatives, but selected role runtime is a hard requirement.

### Iris

Files:

* `refer_proj/Lianues__Iris/docs/agents.md`
* `refer_proj/Lianues__Iris/tests/cross-agent-task-board.test.ts`
* `refer_proj/Lianues__Iris/tests/delegate-agent.test.ts`

Useful rules:

* Multiple agents can have independent sessions, memory and config overrides.
* A global task board can track sub-agent and cross-agent delegate tasks.
* Cross-agent communication returns to the source agent through task-board events.

AgentHub adaptation:

* AgentHub should not create a separate data root per role. The durable truth is workspace/session/role_agent/plan/runtime_session/message.
* The task-board concept maps to `plans`, `plan_nodes`, mailbox/handoff rows and runtime jobs.

### Claude Codex Bridge

Files:

* `refer_proj/SeemSeam__claude_codex_bridge/docs/agent-mailbox-kernel-design.md`
* `refer_proj/SeemSeam__claude_codex_bridge/test/test_v2_mailbox_kernel_service.py`
* `refer_proj/SeemSeam__claude_codex_bridge/test/test_v2_completion_orchestration.py`

Useful rules:

* Sender/receiver are agents, not providers.
* Per-agent inbound consumption is serial.
* Reply is not a direct callback; it becomes a durable inbound event.
* Retry creates a new attempt and preserves lineage.
* Broadcast can be parallel across agents; single agent remains serial.

AgentHub adaptation:

* Add or extend durable mailbox/handoff/attempt/reply structures.
* Keep provider/backend fact reporting separate from Orchestrator policy.
* Plan node retry/resume/cancel should create attempts instead of overwriting runtime evidence.

## Current AgentHub Gaps

1. Orchestrator DAG generation is still shallow and partly fixed-template.
2. Handoff exists but is not yet a full mailbox/attempt/reply/lineage kernel.
3. Plan node retry/resume/cancel API is missing.
4. Worker inventory is backend-only; UI does not expose per-role CLI health deeply enough.
5. Browser UAT has not yet proven full Claude+Codex multi-role handoff and native session reuse.

## Recommendation

Create a new product-completion plan instead of extending P0 acceptance closure. The old closure is a validated baseline; this task defines the final multi-agent orchestration target.
