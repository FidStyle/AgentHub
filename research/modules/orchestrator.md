# 模块调研：Orchestrator、计划分派与上下文 Handoff

**日期：** 2026-05-21  
**状态：** Draft  
**覆盖 FR-ID：** `FR-ORCH-001`, `FR-CHAT-001`, `FR-CTX-001`, `FR-AGENT-001`, `FR-PERM-001`, `FR-RESULT-001`  
**相关产品设计：** `research/product-design.md` 第 7、8 章

---

## 1. 调研问题

Orchestrator 是 PM 型 Role Agent，不是所有消息的强制入口。它负责澄清需求、生成计划、请求确认、分派 Role Agent、汇总结果。本模块需要回答：

1. Orchestrator Flow 如何建模？
2. Direct Role Flow 如何升级到 Orchestrated Flow？
3. Context Package 应包含什么？
4. 计划确认和自动推进如何落到状态机？
5. Orchestrator 计划是否需要结构化 DAG 来支持并行调度、失败降级和代码冲突处理？

---

## 2. 状态机建议

```typescript
type OrchestratorRunStatus =
  | 'idle'
  | 'clarifying'
  | 'planning'
  | 'requires_plan_confirmation'
  | 'dispatching'
  | 'waiting_role_result'
  | 'summarizing'
  | 'requires_next_step_confirmation'
  | 'completed'
  | 'failed'
  | 'canceled';
```

### 2.1 Orchestrated Flow

1. `clarifying`: 需求不清时提出问题。
2. `planning`: 生成结构化 Plan DAG，包含步骤、依赖、分派 Role Agent、预期产物、敏感动作。
3. `requires_plan_confirmation`: 默认等待用户确认。
4. `dispatching`: 后端校验 Plan DAG，计算 ready/waiting/blocked/waves，给 ready 节点构造 Context Package 并发给 Role Agent。
5. `waiting_role_result`: 等待 Runtime/Adapter 回传结果；节点完成后重新计算 ready/waiting/blocked。
6. `summarizing`: 汇总并生成下一步。
7. `completed` 或 `requires_next_step_confirmation`。

### 2.2 Direct Role 升级

Direct Role Flow 中，目标 Role Agent 判断任务超出单角色能力时：

1. 生成升级建议。
2. 用户确认升级，或 Session 已授权自动推进。
3. Orchestrator 接管并从 `planning` 开始。

对应需求：`FR-CHAT-001`, `FR-ORCH-001`。

---

## 3. Plan DAG 边界

Plan DAG 是独立研究模块，详细契约集中在 `research/modules/orchestrator-plan-dag.md`。本文件只说明它与 Orchestrator 状态机的关系，避免把 DAG 结构散落到多个模块。

| 层次 | 归属文档 | 负责内容 |
| --- | --- | --- |
| Orchestrator Run 状态机 | `research/modules/orchestrator.md` | 澄清、计划、确认、分派、等待、汇总、失败处理 |
| Plan DAG 契约 | `research/modules/orchestrator-plan-dag.md` | 节点、依赖、并行 wave、阻塞、失败影响范围、结果汇总 |
| 技术设计引用 | `research/technical-design.md` | 只展示实现视角的引用模型，不重复定义完整契约 |

P0 结论：Orchestrator 状态机负责推进阶段；Plan DAG 负责计划内部的依赖与并行。用户看到的是计划卡片；后端看到的是可校验、可调度的结构化计划。

对应需求：`FR-ORCH-001`, `FR-CTX-001`, `FR-AGENT-001`, `FR-RUNTIME-001`, `FR-PERM-001`, `FR-RESULT-001`。

---

## 4. Context Package 建议

```typescript
interface ContextPackage {
  workspaceId: string;
  sessionId: string;
  sourceMessageIds: string[];
  pinnedMessageIds: string[];
  artifactIds: string[];
  fileRefs: Array<{ path: string; reason: string }>;
  priorRoleSummaries: Array<{ roleAgentId: string; summary: string }>;
  currentGoal: string;
  constraints: string[];
}
```

原则：

- Context Package 是可见、可引用、可调试的 handoff 载荷。
- 目标是 Role Agent，不是 Runtime 工具名。
- 绑定 Claude Code/Codex 时，由 Adapter 尝试 resume 原生 session。

对应需求：`FR-CTX-001`, `FR-RUNTIME-001`。

---

## 5. 推荐实现路径

| 方案 | 优点 | 风险 | 适配度 |
| --- | --- | --- | --- |
| 后端服务状态机 + Plan DAG + LLM 调用 | 可控、可测试、便于审批、并行分派和失败降级 | 需要定义计划表、DAG 校验和调度器 | 高 |
| 前端驱动 Orchestrator | 实现快 | 可靠性差，跨端状态难同步 | 低 |
| 全交给单个 Agent 自由发挥 | 快速 Demo | 不可解释、不可验收 | 低 |

**推荐：** 后端维护 Orchestrator Run 状态机和 Plan DAG；LLM 负责生成澄清问题、候选计划和总结，系统负责 DAG 校验、状态推进、权限判断和 ready 节点分派。

---

## 6. 参考项目校准

参考 `research/modules/reference-projects.md`：

- AionUi `agent-team-guide-flow.md` 展示了普通 Agent 判断复杂任务后，向用户建议开启 Team Mode，再通过工具创建团队和跳转页面的流程。
- AionUi ACP rewrite 明确提出“状态机集中”“单队列不变”“只在真实变化轴上抽象”，这直接支持 AgentHub Orchestrator 使用后端状态机托管。
- LobeHub `GraphAgent` 使用 graph-driven execution，把流程转换交给程序判断，不完全交给 LLM 自由漂移。
- LobeHub `taskGraph` 使用 Kahn 拓扑排序把依赖任务分为 layers，并显式处理 cycle、external blocker 和 ineligible 状态。
- codeApe `plan.schema.json` 用 `workers + dependsOn + buckets` 把 Orchestrator 计划保存成机器可读真相源。
- maestro-flow 的 wave DAG 证明复杂任务可以用阶段内并行波次表达，而不是把每个步骤都串行化。
- CCB mailbox kernel 提醒 fan-out/fan-in、wait-all/quorum 和 attempt lineage 是多 Agent 协调的后续扩展点。

这些参考支持当前结论：Orchestrator 应是 PM 型 Role Agent，但计划/审批/分派的状态推进必须由系统状态机和 Plan DAG 共同掌控。

---

## 7. 待用户确认

**推荐确认项：**

A. Orchestrator 使用后端状态机 + Plan DAG 托管，LLM 只生成候选计划内容和总结。
B. Orchestrator 作为普通 Role Agent，自由调用工具推进。
C. P0 暂不实现 Direct Flow 升级，只做默认 Orchestrator。

我的建议是 **A**。它最符合“可解释、可审批、可验收”的产品要求，也能支撑 bytedance 原始素材要求的并行调度、失败降级和代码冲突处理。

---

## 8. 参考资料

- OpenAI Agents SDK 概念文档：https://openai.github.io/openai-agents-python/
- LangGraph 文档：https://langchain-ai.github.io/langgraph/
- `research/modules/orchestrator-plan-dag.md`
