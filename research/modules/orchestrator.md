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
2. `planning`: 生成步骤、分派 Role Agent、预期产物、敏感动作。
3. `requires_plan_confirmation`: 默认等待用户确认。
4. `dispatching`: 构造 Context Package，发给 Role Agent。
5. `waiting_role_result`: 等待 Runtime/Adapter 回传结果。
6. `summarizing`: 汇总并生成下一步。
7. `completed` 或 `requires_next_step_confirmation`。

### 2.2 Direct Role 升级

Direct Role Flow 中，目标 Role Agent 判断任务超出单角色能力时：

1. 生成升级建议。
2. 用户确认升级，或 Session 已授权自动推进。
3. Orchestrator 接管并从 `planning` 开始。

对应需求：`FR-CHAT-001`, `FR-ORCH-001`。

---

## 3. Context Package 建议

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

## 4. 推荐实现路径

| 方案 | 优点 | 风险 | 适配度 |
| --- | --- | --- | --- |
| 后端服务状态机 + LLM 调用 | 可控、可测试、便于审批和分派 | 需要定义事件和状态表 | 高 |
| 前端驱动 Orchestrator | 实现快 | 可靠性差，跨端状态难同步 | 低 |
| 全交给单个 Agent 自由发挥 | 快速 Demo | 不可解释、不可验收 | 低 |

**推荐：** 后端维护 Orchestrator Run 状态机；LLM 负责生成澄清问题、计划和总结，系统负责状态推进、权限判断和分派。

---

## 5. 参考项目校准

参考 `research/modules/reference-projects.md`：

- AionUi `agent-team-guide-flow.md` 展示了普通 Agent 判断复杂任务后，向用户建议开启 Team Mode，再通过工具创建团队和跳转页面的流程。
- AionUi ACP rewrite 明确提出“状态机集中”“单队列不变”“只在真实变化轴上抽象”，这直接支持 AgentHub Orchestrator 使用后端状态机托管。
- LobeHub `GraphAgent` 使用 graph-driven execution，把流程转换交给程序判断，不完全交给 LLM 自由漂移。

这些参考支持当前结论：Orchestrator 应是 PM 型 Role Agent，但计划/审批/分派的状态推进必须由系统状态机掌控。

---

## 6. 待用户确认

**推荐确认项：**

A. Orchestrator 使用后端状态机托管，LLM 只生成计划内容和总结。  
B. Orchestrator 作为普通 Role Agent，自由调用工具推进。  
C. P0 暂不实现 Direct Flow 升级，只做默认 Orchestrator。

我的建议是 **A**。它最符合“可解释、可审批、可验收”的产品要求。

---

## 7. 参考资料

- OpenAI Agents SDK 概念文档：https://openai.github.io/openai-agents-python/
- LangGraph 文档：https://langchain-ai.github.io/langgraph/
