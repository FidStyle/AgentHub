# 模块调研：Runtime Adapter 与 Claude Code/Codex 会话连续

**日期：** 2026-05-21  
**状态：** Draft  
**覆盖 FR-ID：** `FR-RUNTIME-001`, `FR-AGENT-001`, `FR-CTX-001`, `FR-DESK-001`, `FR-RESULT-001`  
**相关产品设计：** `research/product-design.md` 第 7、8 章

---

## 1. 调研问题

PRD 已明确：接入 Claude Code/Codex 的目的不是简单 API 调用，而是复用原生会话上下文。用户单独打开 Claude Code/Codex 时也应尽量看到或继续对应记录。

本模块需要回答：

1. Adapter 抽象应如何设计？
2. Claude Code 和 Codex 是否有 CLI resume/continue 能力？
3. native session identity 如何记录？
4. Role Agent 如何与 Runtime 分离？

---

## 2. 外部能力事实

### 2.1 Claude Code

Claude Code 官方 CLI 文档包含继续最近对话和恢复指定会话的能力，例如 `--continue` 和 `--resume` 形态。P0 可以围绕这些能力设计 Claude Adapter，但具体命令参数和输出格式要在实现阶段用本机版本验证。

### 2.2 Codex CLI

OpenAI Codex CLI 官方 reference 包含 `codex resume`，用于恢复交互会话；也有 `codex exec resume` 一类非交互恢复入口。P0 可以记录 Codex native session id，并在后续请求中调用 resume。

---

## 3. Adapter 抽象建议

```typescript
interface RuntimeAdapter {
  kind: 'hosted' | 'claude_code' | 'codex';
  detect(): Promise<RuntimeDetectionResult>;
  startOrResume(input: RuntimeInvokeInput): AsyncIterable<RuntimeEvent>;
  cancel(invocationId: string): Promise<void>;
}

interface RuntimeInvokeInput {
  workspaceId: string;
  sessionId: string;
  roleAgentId: string;
  executionDomain: 'cloud' | 'local_desktop';
  contextPackage: ContextPackage;
  nativeSessionId?: string;
  userMessage: string;
}

type RuntimeEvent =
  | { type: 'started'; invocationId: string; nativeSessionId?: string }
  | { type: 'text_delta'; content: string }
  | { type: 'action_requested'; actionRequestId: string }
  | { type: 'artifact_created'; artifactId: string }
  | { type: 'completed'; summary?: string; nativeSessionId?: string }
  | { type: 'failed'; errorCode: string; message: string };
```

核心原则：

- Adapter 接收结构化输入，不接收裸 prompt。
- Role Agent 是用户可见对象，Runtime 是执行后端。
- Runtime 支持时必须记录 native session identity。
- 后续消息优先 resume/continue 同一个 native session。

对应需求：`FR-RUNTIME-001`, `FR-AGENT-001`, `FR-CTX-001`。

---

## 4. 候选实现路径

| 方案 | 优点 | 风险 | 适配度 |
| --- | --- | --- | --- |
| CLI 子进程 Adapter | 真实使用用户本机 Claude/Codex；能共享原生 session | 输出解析和交互控制复杂 | 高 |
| SDK/API Adapter | 易结构化、稳定 | 无法满足“原生 session 连续”核心差异 | 低 |
| 伪 Adapter Demo | 快速演示 UI | 不能证明真实 Runtime 接入 | 低 |

**推荐：** P0 使用 CLI 子进程 Adapter。Hosted Runtime 可作为 Cloud Workspace 的兜底，但本地 Claude Code/Codex 必须走 Desktop Connector 调 CLI。

---

## 5. 会话连续策略

建议记录：

- `runtimeKind`: `claude_code` 或 `codex`
- `nativeSessionId`: Runtime 返回或 CLI 可恢复的 session 标识
- `workspaceId`
- `sessionId`
- `roleAgentId`
- `adapterVersion`
- `lastInvocationAt`

当用户在同一 AgentHub Session 中继续对同一 Role Agent 说话：

1. 查询是否存在 `nativeSessionId`。
2. 存在则调用 resume/continue。
3. 不存在则新建 Runtime 会话。
4. Runtime 返回新标识时更新绑定。

---

## 6. 待用户确认

**推荐确认项：**

A. P0 把 CLI 子进程 Adapter 作为 Claude Code/Codex 唯一路线，严格验证 native session 连续。  
B. P0 先用 API/SDK 模拟，后续再补 CLI。  
C. P0 只做 Claude Code，不做 Codex。

我的建议是 **A**。这是产品差异点，不能在 P0 弱化成普通 API 调用。

---

## 7. 参考资料

- Claude Code CLI 文档：https://docs.anthropic.com/en/docs/claude-code/cli-reference
- OpenAI Codex CLI Reference：https://developers.openai.com/codex/cli/reference
- OpenAI Codex CLI GitHub：https://github.com/openai/codex
