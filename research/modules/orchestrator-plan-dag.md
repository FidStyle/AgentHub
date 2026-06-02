# 模块调研：Orchestrator Plan DAG

**日期：** 2026-05-22
**状态：** Draft；2026-06-02 增补 final multi-agent v2 边界
**覆盖 FR-ID：** `FR-ORCH-001`, `FR-CTX-001`, `FR-AGENT-001`, `FR-RUNTIME-001`, `FR-PERM-001`, `FR-RESULT-001`
**相关产品设计：** `research/product/product-design.md` 第 7、8 章
**上游依据：** `bytedance_init_prd.md`, `bytedance_init_video_txt.txt`, `research/modules/orchestrator.md`

---

## 1. 为什么需要 Plan DAG

原始素材对 Orchestrator 的要求不是普通线性待办列表：

- `bytedance_init_prd.md` 明确要求群聊模式下由 Orchestrator 自动协调分工，支持复杂任务拆解、子 Agent 分派、聚合产出、并行调度、失败降级和代码冲突处理。
- `bytedance_init_video_txt.txt` 把主 Agent 类比为 PM/PMO，强调逐步追问、理清需求、拆解任务、分派子 Agent、拿到结果后汇报给用户，并处理并行调度、失败降级和代码冲突。
- 上下文 handoff 是评审关注点：A Agent 的上下文需要平滑迁移到 B Agent。

如果 P0 只保存线性步骤列表，会缺少四个关键能力：

1. 判断哪些 Role Agent 节点可以并行执行。
2. 判断失败节点会阻塞哪些后续节点。
3. 判断多个节点是否会修改同一文件或依赖同一产物。
4. 为每个 Role Agent 明确输入上下文、预期产物和 handoff 来源。

因此 AgentHub P0 应把 Orchestrator 的计划内部建模为 **Plan DAG**。用户看到的仍是 IM 中的计划卡片；DAG 是后端编排和验收的结构化骨架。

---

## 2. 参考项目证据

### 2.1 LobeHub GraphAgent

相关文件：

- `refer_proj/lobehub/packages/agent-runtime/src/agents/GraphAgent.ts`
- `refer_proj/lobehub/packages/agent-runtime/src/types/graph.ts`

关键发现：

- `GraphAgent` 使用声明式 `ReasoningGraph` 驱动执行，而不是让 LLM 自由决定下一步。
- 图节点分为 `agent` 和 `llm` 两类；`agent` 节点允许工具循环，结束后再抽取结构化输出。
- graph transition 由程序根据结构化输出判断，避免状态漂移。
- graph context 保存在 agent state 中，包含当前节点、结构化 store、访问次数和 backtrack 次数。

对 AgentHub 的影响：

- Orchestrator 可以让 LLM 生成计划内容，但计划推进必须由后端程序判断。
- 每个 PlanNode 的输出应结构化持久化，供后续节点通过 Context Package 引用。
- P0 不需要完整 LangGraph 引擎，但需要自己的轻量 Plan DAG validator 和 scheduler。

### 2.2 LobeHub TaskGraph

相关文件：

- `refer_proj/lobehub/src/server/services/taskGraph/index.ts`
- `refer_proj/lobehub/src/server/services/taskGraph/index.test.ts`
- `refer_proj/lobehub/packages/database/src/schemas/task.ts`

关键发现：

- `planSubtaskLayers` 使用 Kahn 拓扑排序把可运行任务分成 `layers`。
- 已完成或取消的上游任务被视为依赖已满足。
- running/scheduled/unknown/out-of-scope 上游任务会阻塞下游任务，不会被静默丢弃。
- 支持检测 cycle、blockedByCycle、blockedExternally、ineligible。
- 测试覆盖独立并行、线性链、菱形依赖、已完成上游、失败重跑、环、外部阻塞、阻塞传递。

对 AgentHub 的影响：

- P0 scheduler 应按 topological layers 派发 ready nodes。
- 任何未知依赖或执行中依赖都必须阻塞下游节点，不能乐观启动。
- cycle 和 external blocker 必须成为计划校验错误或计划卡片中的阻塞原因。

### 2.3 `codeApe ai-agent-workflowGroup`

相关文件：

- `refer_proj/codeApe-7__ai-agent-workflowGroup/schemas/orchestration/plan.schema.json`
- `refer_proj/codeApe-7__ai-agent-workflowGroup/scripts/orchestration/lib/orchestrator.cjs`

关键发现：

- `plan.schema.json` 把 worker、state、dependsOn、objective 和 buckets 持久化为机器可读计划。
- buckets 包含 `ready`、`running`、`blocked`、`completed`、`failed`、`waiting`。
- ready 的定义是 `not_started + all dependencies completed`。
- 计划 JSON 是唯一真相源，人类可读视图可由 JSON 渲染。

对 AgentHub 的影响：

- AgentHub 应把 OrchestratorPlan 和 PlanNode 作为数据库真相源，而不是只把计划写成 Markdown 消息。
- 计划卡片应从结构化 Plan DAG 渲染，审批也应绑定 plan/version，而不是绑定一段自然语言。

### 2.4 `maestro-flow` ChainGraph 与 Wave DAG

相关文件：

- `refer_e2e_proj/maestro-flow/src/coordinator/graph-types.ts`
- `refer_e2e_proj/maestro-flow/src/coordinator/graph-walker.ts`
- `refer_e2e_proj/maestro-flow/chains/quality-loop.json`
- `refer_e2e_proj/maestro-flow/dashboard/src/__tests__/e2e/workflow-coordinate.e2e.test.ts`
- `refer_e2e_proj/maestro-flow/dashboard/src/__tests__/e2e/issue-execute.e2e.test.ts`

关键发现：

- `ChainGraph` 明确区分 `command`、`decision`、`gate`、`fork`、`join`、`eval`、`terminal` 七类节点，说明 workflow 生命周期和任务依赖应结构化表达。
- `GraphWalker` 对每个节点维护 visit count，并通过 `max_visits` 防止 debug/fix/retry 循环无限运行。
- decision node 先走表达式判断，必要时才走 LLM fallback；这支持 AgentHub 的原则：LLM 可以辅助判断，但系统必须保留可解释、可验证的默认路径。
- gate node 可以进入 `waiting_gate`，这与 AgentHub 高风险 Action、计划确认、权限确认的暂停点一致。
- fork/join 支持并行分支和 `all/any/majority` 聚合；AgentHub P0 只需要 `wait-all`，但数据模型不应阻断 P1 扩展。
- `quality-loop.json` 把 `verify -> business_test -> review -> test -> debug -> plan_gaps -> re_execute` 做成 decision gate 循环，证明质量闭环应是状态机，而不是执行完一次就结束。

对 AgentHub 的影响：

- P0 计划卡片宜展示「并行组/波次」，而不是复杂可拖拽 DAG。
- Orchestrator 不应把每一步都串行化。只要依赖已满足，同一 wave 的节点可以并行派发。
- Plan DAG validator 必须覆盖 retry 上限、等待确认节点、并行分支聚合、失败后 blocked 传播。
- Maestro Plan 进入 `execute` 前必须声明首个 Test Anchor；`FR-ORCH-001` 的首个锚点应是 DAG validator 和 ready wave 调度测试。

### 2.5 claude_codex_bridge Mailbox Kernel

相关文件：

- `refer_proj/SeemSeam__claude_codex_bridge/docs/agent-mailbox-kernel-design.md`

关键发现：

- 多 Agent 通信需要区分 message、attempt 和 execution。
- 成熟编排需要 fan-out/fan-in、wait-any、wait-all、quorum、retry、resubmit、dead-letter、lineage。
- 每个 agent 的入站消费应串行，投递不等于消费。

对 AgentHub 的影响：

- P0 可以只做 `wait-all` 风格 fan-in：一个 wave 内所有必需节点完成后汇总。
- quorum、dead-letter、复杂 retry lineage 可进入 P1/P2，但数据模型不要阻碍后续扩展。

---

## 3. 推荐 P0 模型

### 3.1 核心原则

1. **状态机包 DAG。** Orchestrator Run 状态机管生命周期；Plan DAG 管计划内部依赖和并行。
2. **LLM 生成候选计划，系统校验和执行。** LLM 不直接决定可执行性。
3. **Plan DAG 是真相源。** 计划卡片、审批、Role Agent 分派、失败展示都从结构化计划渲染。
4. **P0 不做可视化编辑器。** 用户看到结构化计划卡片、并行组、阻塞原因和修改计划入口即可。

### 3.2 数据契约草案

| 对象 | 必要信息 | 说明 |
| --- | --- | --- |
| Orchestrator Plan | run、workspace、session、版本号、状态、摘要 | 一次 Orchestrator run 可以有多个 plan version |
| Plan Node | 节点 ID、角色 Agent、标题、目标、依赖、预期产物、上下文包、风险等级、节点状态、结果引用 | 一个节点代表一个可分派给角色 Agent 的子任务 |
| Plan Edge | 起点、终点、关系类型、原因 | 关系类型包括阻塞、handoff、审查、潜在冲突 |
| Computed State | ready、running、waiting、blocked、completed、failed、cycles、waves | 由后端根据节点和依赖计算，不由 LLM 直接填写 |

Plan DAG 的实现细节放到 Phase 3 任务或代码规范中定义。模块研究只固定产品和架构契约：它必须能支持依赖、并行、阻塞、失败影响范围和结果汇总。

### 3.3 P0 校验规则

| 校验 | 失败处理 | 绑定需求 |
| --- | --- | --- |
| DAG 无环 | 计划不能进入确认，要求 Orchestrator 重新规划 | `FR-ORCH-001` |
| node.roleAgentId 属于当前 Workspace | 计划不能执行 | `FR-AGENT-001` |
| Role Agent Runtime 与 Workspace 执行域一致 | 计划不能执行 | `FR-RUNTIME-001` |
| 所有 dependsOn 指向同计划内节点或已完成节点 | 未知依赖进入 blocked，不得执行 | `FR-ORCH-001` |
| 高风险节点或 Action 存在权限确认 | 自动推进也必须停下 | `FR-PERM-001` |
| 同一 wave 内高概率文件冲突 | P0 展示风险并默认串行或要求确认 | `FR-RESULT-001` |

### 3.4 P0 调度规则

1. `planning` 阶段生成 draft plan。
2. 后端运行 Plan DAG validator，计算 `waves`、`ready`、`waiting`、`blocked`。
3. 计划卡片展示步骤、Role Agent、依赖、并行组、风险动作。
4. 用户确认后，计划进入 `approved`。
5. scheduler 派发当前 `ready` 节点；同 wave 内可并行。
6. 每个节点执行前构造独立 Context Package。
7. 节点完成后写入 TaskResult，重新计算 ready/waiting/blocked。
8. 所有必需节点 completed 后进入 `summarizing`。
9. 节点 failed 时，Orchestrator 进入失败处理：重试节点、跳过节点、重规划、停止。

---

## 4. P0 / P1 / P2 边界

| 能力 | P0 | P1/P2 |
| --- | --- | --- |
| 结构化 Plan DAG | 必做 | 持续增强 |
| 无环校验、ready/waiting/blocked 计算 | 必做 | 增加更丰富 blocker 类型 |
| 并行 wave 派发 | P0 支持最小并行 | 增加资源配额、优先级、取消传播 |
| 计划卡片展示依赖 | 必做，文本/分组即可 | Mini DAG 可视化 |
| 手动拖拽编辑 DAG | 不做 | P2 |
| wait-all fan-in | 必做 | wait-any/quorum |
| 失败降级 | 节点级重试/停止/重规划 | dead-letter、lineage、自动补偿 |
| 代码冲突处理 | 展示风险、必要时串行化 | 自动合并策略、workspace branch 隔离 |

---

## 5. 推荐结论

AgentHub 应将 Orchestrator 设计升级为 **后端状态机 + Orchestrator Plan DAG**：

- 状态机负责聊天流程、审批、自动推进和失败分支。
- Plan DAG 负责计划节点、依赖、并行、阻塞、结果汇总。
- LLM 负责提出候选计划和总结，系统负责校验、调度和权限控制。
- P0 不做复杂 DAG 编辑器，但必须把 DAG 作为内部数据契约实现。

这条路线最符合 bytedance 原始要求中的「复杂任务拆解、并行调度、失败降级、代码冲突处理」和 IM 产品形态，不会把 P0 过度扩展为工作流编排平台。

---

## 6. Final Multi-Agent v2 增补（2026-06-02）

`COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02` 不改变“状态机 + Plan DAG”的核心路线，但完整产品实现需要把 P0 基础 DAG 扩展成 durable recovery DAG。

### 6.1 新增执行级对象

| 对象 | 说明 | 完成口径 |
| --- | --- | --- |
| Plan Node Attempt | 某个 plan node 的一次执行尝试 | retry/resume/cancel/requeue 必须创建或更新 attempt，不覆盖旧证据 |
| Mailbox Item | 角色间或 Orchestrator 间 durable 入站/出站/回复事件 | handoff 不再只存在于 message metadata |
| Lineage Root | 一组 attempt/reply 的根 | UI/API 可追踪失败、重试、继续和最终成功 |
| Dead Letter | 无法投递或超出重试限制的 inbound item | 不能静默丢弃或标 completed |
| Runtime Inventory Snapshot | 调度前的 Claude Code/Codex 可用性、认证、launch、capability | routing 仍按 role runtime 硬约束，不 fallback |

### 6.2 调度规则修订

- ready wave 仍按依赖计算，但入站消费还必须满足 per-role serialization。
- 同一 Role Agent 在同一 session 内一次只消费一个 inbound mailbox item；不同 Role Agent 可以并发。
- node 的完成态以最新有效 attempt 为准，但旧 attempt/runtime logs 必须可读。
- retry 只影响目标 node 和受其影响的下游 recompute，不允许把整 plan 直接标 completed。
- resume 必须复用同 `(session_id, role_agent_id, runtime_type, cwd)` 的 native session；无法 resume 时返回明确状态或按 API 合同创建新 attempt。
- cancel/interrupt 必须传播到 downstream waiting/blocked policy，并写 durable evidence。

### 6.3 完整实现 Phase 对应

1. Phase 1 建 schema/API：mailbox、attempt、reply、lineage、runtime inventory、plan-node controls。
2. Phase 2 建 scheduler：动态 DAG、ready wave、wait-all fan-in、per-role inbound serialization。
3. Phase 3 接 runtime/native session：Claude Code/Codex resume、cancel、failure evidence。
4. Phase 4 做 UI：timeline、node detail、handoff viewer、attempt logs、retry/resume/cancel/requeue。
5. Phase 5 做真实 UAT：Claude+Codex 双 CLI、多角色、失败注入和刷新持久化。

P0 acceptance closure 只能证明基础 canonical 线路可跑；不能替代本 v2 完整完成证据。
