# 模块调研：Runtime Adapter 与 Claude Code/Codex 会话连续

**日期：** 2026-05-21  
**状态：** Draft  
**覆盖 FR-ID：** `FR-RUNTIME-001`, `FR-AGENT-001`, `FR-CTX-001`, `FR-DESK-001`, `FR-RESULT-001`, `FR-PERM-001`  
**相关产品设计：** `research/product-design.md` 第 7、8 章

---

## 1. 调研问题

PRD 已明确：接入 Claude Code/Codex 的目的不是简单 API 调用，而是复用原生会话上下文。用户单独打开 Claude Code/Codex 时也应尽量看到或继续对应记录。

本模块需要回答：

1. Adapter 抽象应如何设计，才能同时覆盖 CLI 子进程和未来 HTTP/SSE Runtime？
2. Claude Code 和 Codex 的 launch、resume、continue 能力如何进入统一模型？
3. native session identity 如何记录、发现和回填？
4. Role Agent 如何与 Runtime 分离，避免把 Claude Code/Codex 暴露成聊天对象？
5. 进程生命周期、输出解析、权限审批和错误归一化应如何分层？

---

## 2. 外部能力事实

### 2.1 Claude Code

Claude Code 官方 CLI 文档包含继续最近对话和恢复指定会话的能力，例如 `--continue` 和 `--resume` 形态。

参考项目还显示可通过 stdin 写入 prompt、通过 stream JSON/JSONL 读取事件，并从 `~/.claude/projects/<encoded-path>/*.jsonl` 发现原生会话。

P0 可以围绕这些能力设计 Claude Adapter。

具体参数、JSON event schema、session ID 字段和项目路径编码规则必须在实现阶段用本机版本验证，不能把参考项目中的参数当作长期稳定 API。

### 2.2 Codex CLI

OpenAI Codex CLI reference 包含 `codex resume`，用于恢复交互会话；也有 `codex exec --json` 和 `codex exec resume <session_id> --json` 一类非交互 JSONL 入口。

参考项目和本地扫描都指向 `~/.codex/sessions/**/*.jsonl` 作为 Codex 原生会话发现位置。

Codex 的审批、权限、工具调用状态需要作为一等事件归一化到 AgentHub，而不是只拼接成文本。P0 可以记录 Codex native session ID，并在后续请求中调用 resume。

### 2.3 OpenCode

OpenCode 不进入 P0 实现范围，但 Adapter 模型不能假设所有 Runtime 都是本地 child process + stdout JSONL。

OpenCode 这类 Runtime 可能采用 HTTP/SSE server-style 接入。P0 需要在接口层预留 `supportsHttpSse` 和 streaming event 能力，避免 P1/P2 增加 OpenCode 时推翻抽象。

---

## 3. Adapter 分层建议

Runtime Adapter 不应把进程管理、协议解析、AgentHub 事件模型和持久化写在一起。建议分为四层：

| 层级 | 职责 | 不应承担 |
| --- | --- | --- |
| Runtime Detector | 检测 CLI/服务是否存在、版本、认证状态、能力声明 | 不启动实际任务 |
| Process/Transport Layer | launch、cancel、restart、stdin、stdout、stderr、exit、timeout、HTTP/SSE 连接 | 不理解 Claude/Codex 语义 |
| Runtime Parser | 把 Claude/Codex/OpenCode 原始行、JSONL、SSE event 映射为归一化事件 | 不直接写数据库 |
| Runtime Session Store | 保存 AgentHub session 与 native session 绑定、状态、capability snapshot | 不修改原生 session 文件 |

核心边界：Process/Transport 只处理生命周期和字节流，Adapter-specific parser 才理解 Runtime 事件。Resume 是各 Adapter 的命令流，不是通用文件修改。

对应需求：`FR-RUNTIME-001`, `FR-DESK-001`, `FR-CTX-001`, `FR-PERM-001`。

---

## 4. Adapter 抽象建议

下面是偏 TypeScript 的接口草案，重点是能力检测、显式进程/会话方法和归一化事件，不追求一次性覆盖所有未来 Runtime。

```typescript
type RuntimeKind = 'hosted' | 'claude_code' | 'codex' | 'opencode';
type ExecutionDomain = 'cloud' | 'local_desktop';

interface RuntimeCapabilities {
  supportsResume: boolean;
  supportsContinue: boolean;
  supportsApprovals: boolean;
  supportsNativeSessionDiscovery: boolean;
  supportsHttpSse: boolean;
  supportsMcpConfig: boolean;
  supportsPermissionModes: boolean;
  supportsStreamingEvents: boolean;
}

interface RuntimeAdapter {
  kind: RuntimeKind;
  adapterVersion: string;

  detect(input: RuntimeDetectInput): Promise<RuntimeDetectionResult>;
  getCapabilities(input: RuntimeDetectInput): Promise<RuntimeCapabilities>;

  createSession(input: RuntimeInvokeInput): Promise<RuntimeInvocation>;
  resumeSession(input: RuntimeResumeInput): Promise<RuntimeInvocation>;
  continueLatest(input: RuntimeContinueInput): Promise<RuntimeInvocation>;

  stream(invocationId: string): AsyncIterable<RuntimeEvent>;
  sendInput(invocationId: string, input: RuntimeStdinInput): Promise<void>;
  cancel(invocationId: string): Promise<void>;
  restart(invocationId: string): Promise<RuntimeInvocation>;

  discoverNativeSessions(input: NativeSessionDiscoveryInput): Promise<NativeSessionRef[]>;
}

interface RuntimeInvokeInput {
  workspaceId: string;
  sessionId: string;
  roleAgentId: string;
  executionDomain: ExecutionDomain;
  cwd: string;
  contextPackage: ContextPackage;
  userMessage: string;
  permissionMode?: 'default' | 'plan' | 'read_only' | 'dangerous_bypass';
  mcpConfigRef?: string;
}

interface RuntimeResumeInput extends RuntimeInvokeInput {
  nativeSessionId: string;
}

interface RuntimeContinueInput extends RuntimeInvokeInput {
  strategy: 'latest_for_cwd' | 'latest_for_role_agent';
}

interface RuntimeInvocation {
  invocationId: string;
  runtimeKind: RuntimeKind;
  nativeSessionId?: string;
  processId?: number;
  transport: 'child_process_jsonl' | 'child_process_text' | 'http_sse';
  capabilities: RuntimeCapabilities;
}
```

核心原则：

- Adapter 接收结构化输入，不接收裸 prompt。
- Role Agent 是用户可见对象，Runtime 是执行后端。
- Runtime 支持时必须记录 native session identity。
- 后续消息优先 resume/continue 同一个 native session。
- 能力快照随 runtime session 保存，避免升级 CLI 后历史行为难以解释。

---

## 5. 归一化事件模型

Claude Code、Codex 和未来 OpenCode 的原始事件字段不同，但 AgentHub 的 IM、任务状态、审批、产物展示需要稳定事件模型。建议把 Runtime parser 输出为以下事件族：

```typescript
type RuntimeEvent =
  | { type: 'started'; invocationId: string; nativeSessionId?: string }
  | { type: 'session_discovered'; nativeSessionId: string; source: 'stdout' | 'jsonl' | 'filesystem' }
  | { type: 'text_delta'; content: string; channel?: 'assistant' | 'thinking' | 'system' }
  | { type: 'tool_started'; toolCallId: string; name: string; inputPreview?: string }
  | { type: 'tool_delta'; toolCallId: string; content: string }
  | { type: 'tool_completed'; toolCallId: string; outputPreview?: string; exitCode?: number }
  | { type: 'approval_requested'; approvalId: string; reason: string; commandPreview?: string }
  | { type: 'permission_mode_changed'; mode: string; reason?: string }
  | { type: 'artifact_created'; artifactId: string; path?: string; mimeType?: string }
  | { type: 'completed'; summary?: string; nativeSessionId?: string }
  | { type: 'failed'; errorCode: RuntimeErrorCode; message: string; retryable: boolean }
  | { type: 'cancelled'; reason?: string };
```

事件命名必须保持中性，不能把所有 Runtime 输出都命名为 `ClaudeCodeMessage`。

Codex 的 approval 事件应映射为 `approval_requested`，再进入 AgentHub 的权限审批流；Claude Code 的工具调用、MCP 调用、权限模式变化也应走同一事件族。

事件持久化应以 AgentHub event table 为真相，实时通道只负责投递。断线重连后，Web/Mobile/Desktop 从持久化事件和 runtime session 状态补偿，不依赖前端内存。

---

## 6. 各 Runtime launch/resume 模式

| Runtime | P0/P1 | 新会话 | 恢复会话 | 原生会话发现 | 关键注意 |
| --- | --- | --- | --- | --- | --- |
| Claude Code | P0 | CLI 子进程，stream JSON/JSONL，stdin 写 prompt | `--resume <id>` 或 `--continue` 形态，具体参数实现时验证 | `~/.claude/projects/<encoded-path>/*.jsonl` | session 路径和 JSON schema 是实现细节；权限绕过不能默认开启 |
| Codex | P0 | `codex exec --json` 类入口 | `codex exec resume <session_id> --json` 类入口 | `~/.codex/sessions/**/*.jsonl` | approval 需要归一化成一等事件；resume 失败要可解释 |
| OpenCode | P1/P2 | 可能是 HTTP/SSE server-style runtime | 取决于服务 API | 取决于服务 API | 抽象层必须支持 `http_sse`，不能绑定 child process JSONL |

P0 推荐只实现 Claude Code 和 Codex 的 CLI subprocess Adapter。OpenCode 作为兼容性约束进入接口设计，不作为 P0 交付承诺。

---

## 7. 会话持久化与发现策略

建议 `runtime_sessions` 或同等模型至少记录：

- `workspaceId`
- `sessionId`
- `roleAgentId`
- `runtimeKind`: `claude_code`、`codex`、`opencode` 或 `hosted`
- `nativeSessionId`: Runtime 返回或 CLI 可恢复的 session 标识
- `adapterVersion`
- `executionDomain`: `cloud` 或 `local_desktop`
- `cwd` / project path
- `capabilitiesSnapshot`
- `status`: `starting`、`running`、`awaiting_approval`、`completed`、`failed`、`cancelled`
- `lastInvocationAt`

当用户在同一 AgentHub Session 中继续对同一 Role Agent 说话：

1. 查询是否存在同一 `workspaceId/sessionId/roleAgentId/runtimeKind/executionDomain/cwd` 下的 runtime session。
2. 存在 `nativeSessionId` 且 capability 支持 `supportsResume` 时，调用 Adapter 的 `resumeSession`。
3. 没有 `nativeSessionId` 但支持 `supportsContinue` 时，按明确策略调用 `continueLatest`。
4. 都不满足时新建 Runtime 会话。
5. Runtime 输出或文件扫描发现新 `nativeSessionId` 后，异步回填绑定。

Native session discovery 只用于发现和校准，不应通过直接编辑 `~/.claude` 或 `~/.codex` 下的 JSONL 来实现 resume。原生文件路径属于 Runtime 内部实现，必须记录版本并提供失败降级方案。

---

## 8. 进程生命周期与配置合并

Process layer 需要提供通用生命周期，不绑定 Claude/Codex 语义：

- launch：命令、参数、cwd、env、stdin 策略、stdout/stderr reader、超时。
- cancel：优雅中断，必要时升级到 kill，并向事件流写入 `cancelled`。
- restart：保留 AgentHub runtime session，重新创建 invocation。
- stdout/stderr：按行或 event frame 读取，reader 必须可取消，避免长任务泄漏。
- exit：区分正常完成、用户取消、CLI 崩溃、找不到命令、认证失败、resume 失败。

配置合并需要借鉴 Cherry Studio 的 MCP service 思路：命令配置、环境变量、PATH、MCP config、重启触发要集中处理。安全边界是：

- 本地 Claude Code / Codex 的 API Key 不属于 P0 Role Agent 配置项；AgentHub 只检测原生 CLI 的认证状态，并引导用户在本机 CLI 或独立模型 Provider 中完成配置。P0 不在 App 内代执行 CLI 登录、设备码轮询或 OAuth 代理流程。
- env 合并必须白名单或显式来源标记，不能把敏感变量无条件注入所有 Runtime。
- PATH 修正要可诊断，不能静默覆盖用户环境。
- MCP/config 应按 runtime session 或 workspace 隔离，避免把 AgentHub 临时配置写成用户全局唯一状态。
- `dangerous_bypass` 这类权限模式不得作为默认值，只能由用户显式选择并可审计。

---

## 9. 候选实现路径

| 方案 | 优点 | 风险 | 适配度 |
| --- | --- | --- | --- |
| CLI 子进程 Adapter | 真实使用用户本机 Claude/Codex；能共享原生 session；最符合产品差异 | 输出解析、权限审批和进程取消复杂 | 高 |
| SDK/API Adapter | 易结构化、稳定 | 无法满足「原生 session 连续」这一核心差异 | 低 |
| HTTP/SSE Runtime Adapter | 适合 OpenCode 或未来本地服务型 Runtime | P0 对 Claude/Codex 不是主路径 | 中，作为 P1/P2 扩展 |
| 伪 Adapter Demo | 快速演示 UI | 不能证明真实 Runtime 接入 | 低 |

**推荐：** P0 使用 CLI 子进程 Adapter。Hosted Runtime 可作为 Cloud Workspace 的备选运行方式，但本地 Claude Code/Codex 必须走 Desktop Connector 调 CLI。OpenCode 不进入 P0，但接口层保留 HTTP/SSE 形态。

---

## 10. 参考项目校准

参考 `research/modules/reference-projects.md` 和本轮 reference repo 深挖：

- `refer_proj/lobehub/apps/desktop/src/main/controllers/HeterogeneousAgentCtr.ts`、`GatewayConnectionCtr.ts`、`ToolDetectorCtr.ts` 是当前最具体的 Electron Desktop + Claude/Codex heterogeneous agent 参考。
  `refer_proj/lobehub/packages/agent-runtime/src/*` 可校准 runtime factory、capability 和错误归一化。
- `refer_proj/AionUi/src/process/acp/infra/{ProcessAcpClient.ts,NdjsonTransport.ts,processUtils.ts}` 是进程/NDJSON transport 生命周期参考，强化「进程管理」和「语义解析」分层。
- `refer_proj/AionUi/src/renderer/pages/settings/AgentSettings/LocalAgents.tsx` 把本地 Agent 做成自动检测和自定义命令配置，模型 API Key 另在 Model 设置中管理；这支持 AgentHub 将本地 CLI Runtime 绑定与模型 Provider 凭证分离。
- `refer_proj/codeg/src/components/settings/acp-agent-settings.tsx` 支持官方订阅、自定义端点和模型 Provider，但它的复杂度更适合作为 P1 高级配置参考；AgentHub P0 不把本地 Claude Code / Codex 默认做成 API Key 托管页。
- `refer_proj/codeg/src-tauri/src/parsers/{claude.rs,codex.rs,opencode.rs}` 展示 Claude、Codex、OpenCode 原生历史/JSONL 解析和多 Runtime parser 快照测试，可作为 session discovery 与历史恢复对照。
- `refer_proj/cherry-studio/src/main/services/MCPService.ts` 对 command config、env、PATH、MCP 配置合并和 restart handling 有参考价值。
- `refer_proj/poco-claw/backend`、`executor`、`executor_manager` 展示多服务执行、callback、session/message/tool 持久化；它不作为 P0 CLI Adapter 主参考，但可校准事件持久化和执行状态回传。

这些参考强化 AgentHub 的结论：P0 不应把 Claude Code/Codex 做成普通 API provider，而应做 CLI 子进程 Runtime Adapter，并把 native session ID、resume、capability、approval、process lifecycle 作为一等字段。

---

## 11. 风险与防护

| 风险 | 影响 | 防护 |
| --- | --- | --- |
| CLI JSON event schema 变化 | Parser 失效，消息或审批丢失 | Adapter 带版本；保留 raw event；解析失败降级为 diagnostic event |
| native session 路径是实现细节 | 发现失败或误绑定 | discovery 仅作辅助；resume 以 CLI 参数为主；按 cwd/runtime/role 校验 |
| 默认危险权限模式 | 本地文件或命令风险扩大 | 默认最小权限；危险模式必须显式授权和审计 |
| env/PATH/MCP 合并不安全 | 凭证泄漏或命令劫持 | env 来源标记、白名单、诊断日志、配置隔离 |
| 长运行 reader 无取消 | 资源泄漏、重复事件 | Process layer 统一 cancellation token 和 reader teardown |
| Runtime 命名污染领域模型 | 后续 OpenCode/Hosted 接入成本上升 | 类型和事件使用中性名称，例如 `RuntimeEvent`、`RuntimeMessage` |
| resume 失败不可解释 | 用户以为上下文连续，实际新会话 | 标准错误码：CLI not found、auth required、resume not found、cwd mismatch、schema unsupported |

---

## 12. 待用户确认

**推荐确认项：**

A. P0 把 CLI 子进程 Adapter 作为 Claude Code/Codex 唯一路线，严格验证 native session 连续。  
B. P0 先用 API/SDK 模拟，后续再补 CLI。  
C. P0 只做 Claude Code，不做 Codex。

我的建议是 **A**。这是产品差异点，不能在 P0 弱化成普通 API 调用。

实现前还需确认：

1. Desktop Connector 是否允许读取 `~/.claude/projects` 和 `~/.codex/sessions` 做 native session discovery。
2. P0 权限默认值是否采用保守模式，并把危险模式放到显式设置。
3. runtime session 表是否由 `packages/shared` 先定义跨端类型，再落后端数据库模型。

---

## 13. 参考资料

- [Claude Code CLI 文档](https://docs.anthropic.com/en/docs/claude-code/cli-reference)
- [OpenAI Codex CLI Reference](https://developers.openai.com/codex/cli/reference)
- [OpenAI Codex CLI GitHub](https://github.com/openai/codex)
- `research/modules/reference-projects.md`
- `refer_proj/lobehub/apps/desktop/src/main/controllers/HeterogeneousAgentCtr.ts`
- `refer_proj/lobehub/packages/agent-runtime/src/*`
- `refer_proj/AionUi/src/process/acp/infra/{ProcessAcpClient.ts,NdjsonTransport.ts,processUtils.ts}`
- `refer_proj/cherry-studio/src/main/services/MCPService.ts`
- `refer_proj/codeg/src-tauri/src/parsers/{claude.rs,codex.rs,opencode.rs}`
