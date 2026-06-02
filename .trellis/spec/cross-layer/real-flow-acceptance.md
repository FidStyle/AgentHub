# 真实主链路验收规范

> 用于防止“看起来完成”“测试假绿”“局部 mock 通过”被误判为 P0 主链路完成。涉及本地对话、远端对话、`@角色`、附件、artifact、Desktop/Web/Mobile 联动时必须遵守。

## 1. Scope / Trigger

触发本规范的任务：

- 声称本地 `local_desktop` 对话已跑通。
- 声称远端 `cloud` 对话已跑通。
- 声称 `@角色` 调度、角色回复、角色上下文或角色持久化已完成。
- 声称附件上传、附件上下文注入或 artifact 产出已完成。
- 修改 `/api/chat`、runtime gateway、runtime worker、DeviceChannel、Desktop runtime host、消息落库、Artifact 面板或 Mobile/PWA 发送链路。

任何上述任务如果只验证页面渲染、按钮可见、HTTP 200、用户消息落库、截图存在、`playwright --list` 或 mock route，不能写“通过”。只能写“未验收”或“组件级通过，主链路未验收”。

## 2. Signatures

主链路涉及的最小接口和事件签名：

- Web 发送：`POST /api/chat`
  - 请求字段：`workspaceId`, `sessionId`, `content`, `roleAgentId`, `attachmentIds?`
  - 响应：SSE `runtime_status`, `runtime_output.delta`, `agent_message`, `artifact_created`, 终态事件之一。
- 附件上传：`POST /api/attachments`
  - 请求字段：文件内容、文件名、MIME、所属 `sessionId` 或上下文绑定信息。
  - 持久化字段：`messages.metadata.attachment.content` 或可重读的 `contentRef`；大文件升级对象存储时必须有等价引用。
- 角色读取：`GET /api/role-agents`
  - 返回字段：`id`, `name`, `role_type`, `capabilities`, `runtime_type`, `is_orchestrator`。
- 本地 runtime：Gateway `user_local` -> DeviceChannel -> Electron `runtime_invoke`
  - 请求字段：`runtimeType`, `prompt`, `workspacePath?`, `sessionId`, `roleAgentId?`, `attachmentRefs?`
  - 回流事件：stdout/stderr delta、exit code、duration、错误码。
- 远端 runtime：Gateway `public_cloud` -> Redis/job queue -> runtime worker -> executor
  - 必须产生 `runtime_sessions` 与 `runtime_logs`，并能读回终态。

## 3. Contracts

### 本地对话 `local_desktop`

通过标准：

- Web 真实入口发送消息，不直接调用内部函数。
- `/api/chat` 进入 `user_local` 分支，经 DeviceChannel 到 Desktop。
- Desktop 收到 `runtime_invoke` 后执行真实 CLI，或返回真实诊断错误：未连接、未安装、未登录、不可启动、执行失败。
- 成功时 agent 回复落入真实 `messages`，刷新页面后仍可见。
- 失败时 UI 显示中文错误，不能落一个伪成功 assistant 回复。

### 远端对话 `cloud`

通过标准：

- `/api/chat` 进入 Gateway/worker 链路，不用 hardcoded SSE 或 echo executor。
- worker 消费真实 job，写 `runtime_sessions` 和 `runtime_logs`。
- agent 回复必须非 echo，并落库可刷新读取。
- worker 不可用时返回 `endpoint_unavailable` 或等价错误，不能把不可用包装成成功。

### `@角色`

通过标准：

- UI 从真实 `GET /api/role-agents` 得到角色列表。
- 发送时请求体携带真实 `roleAgentId`，不是只把 `@角色名` 拼进文本。
- `messages.role_agent_id` 或等价字段持久化；刷新后能恢复角色上下文或角色 badge。
- runtime prompt 中包含角色能力/职责上下文；测试至少断言角色 ID 持久化和用户可见角色标识。
- 角色运行时绑定必须来自 `role_agents.runtime_type`，不能来自 `capabilities` 中的 `runtime:*` 标签；多角色链路必须断言每个角色按自己的 Claude Code / Codex 配置调度。
- 多角色顺序执行时，下游角色必须收到结构化 handoff context，且 `messages.metadata.handoffsReceived` 或等价字段刷新后可读回。

### 附件

通过标准：

- 未实现上传时必须禁用并显示中文原因。
- 声称已实现上传时，必须验证文件内容被持久化或可重读，不得只传文件名。
- 发送 `@角色` 时 `attachmentIds` 进入 `/api/chat`，runtime prompt 能读取附件内容或摘要。
- E2E 必须使用带唯一 token 的附件内容，并在 agent 回复或 artifact 中读到该 token。

### Artifact

通过标准：

- artifact 必须可由 DB/API/文件系统重新读取；仅消息流里出现一段文本不算 durable artifact。
- Artifact 面板刷新后仍能展示同一 artifact title/content/ref。
- 后续自动部署需要消费 artifact 时，必须有稳定 ID 或 contentRef。

## 4. Validation & Error Matrix

| 条件 | 必须结果 | 禁止结果 |
| --- | --- | --- |
| Desktop 未连接 | `local_runtime_offline` / 中文离线提示 | 伪 agent 成功回复 |
| DeviceChannel 曾连接后断开 | `tunnel_disconnected` / 中文重连提示 | 当作从未连接或静默失败 |
| CLI 未安装 | `not_installed` / 安装引导 | 要求用户填写 API Key |
| CLI 未登录 | `auth_required` / 本机 CLI 登录引导 | App 内托管密钥 |
| worker 未启动 | `endpoint_unavailable` | hardcoded SSE 成功 |
| 角色不存在或无权限 | 4xx + 中文错误 | 自动降级成默认角色且声称通过 |
| 附件缺失或超限 | 4xx / disabled / 中文原因 | 只发送文件名并继续 |
| artifact 解析失败 | 明确失败态和日志 | 面板显示假空态且报告通过 |

## 5. Good/Base/Bad Cases

- Good：真实 Web 页面发送 `@架构师` + 附件，cloud worker 产出非 echo 回复和 artifact；DB 读回 `messages.role_agent_id`、附件 contentRef、artifact metadata；刷新页面后仍可见。
- Base：本地 Desktop 未连接时，Web 发送 local workspace 消息得到 `local_runtime_offline`，UI 中文提示，未落伪成功回复。
- Bad：E2E `page.route('/api/chat')` 返回写死 assistant 文本，然后报告“@角色对话通过”。

## 6. Tests Required

声明“实际测试通过”时，报告必须列出：

- 环境：`DATABASE_URL`, `REDIS_URL`, Web base URL、Desktop app/main 路径、是否真实 CLI 登录、是否使用 auth fixture。
- 命令：完整可复现命令和 exit code；不能只写“已跑”。
- 数据证据：至少一个 `workspaceId`, `sessionId`, `messageId` 或 `runtimeSessionId`；附件/artifact 要有唯一 token 或 contentRef。
- 用户证据：截图或 DOM 断言，覆盖发送前、回复后、刷新后。
- 负向证据：runtime 不可用、角色无权限、附件不可用时的错误态。
- 跳过说明：任何 `test.skip`、外部登录、CLI 未登录、worker 未启动都必须写成“未覆盖/未验收”，不得合并进 passed 数。

P0 主链路 E2E 禁止使用 `page.route` mock `/api/chat`, `/api/workspaces`, `/api/sessions`, `/api/messages`, `/api/attachments`, `/api/role-agents` 作为通过证据。组件测试可以 mock，但报告必须标注“组件级”。

## 7. Wrong vs Correct

### Wrong

```text
Web @角色通过：点击发送按钮后出现用户消息，/api/chat 返回 200，截图存在。
```

问题：没有证明 runtime、角色 ID、agent 回复、落库、刷新和 artifact。

### Correct

```text
Web cloud @角色通过：
- 命令：REDIS_URL=... DATABASE_URL=... pnpm env:acceptance:smoke，exit 0。
- 请求：POST /api/chat { workspaceId, sessionId, roleAgentId, attachmentIds }。
- 数据：runtime_sessions.status=completed；messages 中 agent 回复非 echo；role_agent_id=...；artifact metadata 可按 contentRef 重读。
- UI：发送后显示 @架构师回复；刷新 /workspace/:id 后同一回复和 artifact 仍可见。
- 限制：未覆盖外部 GitHub 人工登录，登录状态使用 fixture，只能证明 auth 后主链路。
```

## Scenario: Final Multi-Agent Orchestration Acceptance

### 1. Scope / Trigger

- Trigger: Any report, tracker entry, task status, or implementation claims `COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02` is complete or a phase is accepted.
- Applies to Web, Desktop, Mobile/PWA, `/api/chat`, `/api/plans`, `/api/plan-nodes`, runtime worker, mailbox/handoff rows, `runtime_sessions`, `runtime_logs`, artifacts, acceptance schema and UAT evidence.

### 2. Contracts

- P0 acceptance closure is only a baseline. It cannot be reused as proof that final multi-agent orchestration is complete.
- Final acceptance must use the canonical runtime line: self-hosted Postgres/Redis/Auth.js session/Web Gateway/runtime worker/Claude Code/Codex CLI.
- Acceptance data may be drop/reseeded. No test or UI may depend on old runtime tag routing, old fake/script product executor, old plan/action fallback, or stale message-metadata-only handoff.
- At least one UAT must configure `前端工程师=Claude Code` and `后端工程师=Codex`, then run a single session task that requires both roles.
- The UAT must prove durable DAG, mailbox/handoff attempt/reply/lineage, role runtime routing, native session reuse, node failure, retry/resume, artifact persistence and Web/Desktop/Mobile state consistency.

### 3. Required Evidence

Reports must include:

- Startup commands for `pnpm env:acceptance:up` and `pnpm dev:acceptance`, including `DATABASE_URL` and `REDIS_URL` source.
- Confirmation that Claude Code and Codex CLIs are installed and authenticated on the runtime machine, or a clear "not accepted" statement.
- Real role configuration evidence: role ids, names, `runtime_type`, and refresh persistence.
- Durable data ids: `planId`, `planNodeId`, mailbox/attempt ids, `runtimeSessionId`, at least one `messageId`, and artifact/contentRef when artifacts are claimed.
- UI evidence from Web timeline, Desktop inventory/doctor, and Mobile/PWA supervision or approval surface.
- Failure injection evidence: which node failed, what error was persisted, which retry/resume API/UI action was used, and which new attempt continued the parent plan.

### 4. Not Accepted

- `playwright --list`, grep-only checks, or screenshot-only proof.
- Fake/script executor, hardcoded SSE, echo output, or mock `/api/chat` as product evidence.
- Handoff only in `messages.metadata` without durable mailbox/attempt/reply/lineage rows.
- Runtime fallback from Codex to Claude Code or Claude Code to Codex.
- Plan marked completed while a required node, latest attempt, or summarizer is failed/blocked/unrun.
- Desktop/Mobile status copied from local UI state instead of real API/runtime inventory rows.

## Scenario: No Temporary Compatibility Or Fallback Implementations

### 1. Scope / Trigger

- Trigger: Any implementation or fix that changes API fields, DB schema, runtime routing, env commands, UI entry points, auth/session behavior, or acceptance evidence.
- Applies to Web, Desktop, Mobile/PWA, shared packages, DB/bootstrap scripts, runtime worker/gateway, and all tests claiming product-flow coverage.
- This rule is mandatory after the 2026-06-02 role runtime/handoff correction: future work must implement the canonical product contract directly, not preserve temporary compatibility branches.

### 2. Signatures

Canonical contract examples:

```typescript
type CanonicalRuntimeType = 'claude_code' | 'codex';

interface RoleAgentRow {
  runtime_type: CanonicalRuntimeType;
  capabilities: string[]; // business capabilities only
}

interface AcceptanceStartupEnv {
  DATABASE_URL: string;
  AGENTHUB_DB_CLIENT: 'postgres';
  REDIS_URL: string;
  AUTH_SECRET: string;
  BASE_URL: string;
}
```

Allowed migration shape:

```sql
-- Allowed: convert old data once during schema/bootstrap.
UPDATE public.role_agents
SET runtime_type = 'codex',
    capabilities = capabilities - 'runtime:codex'
WHERE capabilities ? 'runtime:codex';
```

Forbidden runtime shape:

```typescript
// Forbidden: product code reads old field/tag as fallback.
const runtimeType = role.runtime_type ?? runtimeFromCapabilities(role.capabilities);
```

### 3. Contracts

- Runtime/product code must read only the canonical field, command, env key, API payload, or DB column defined in the current spec.
- Backward compatibility branches are not allowed for MVP/P0 product flows unless the user explicitly asks for a versioned migration/deprecation window.
- Existing invalid or old data may be normalized once in migration/bootstrap scripts. After normalization, runtime code must not keep old-field fallback logic.
- Tests must assert the canonical contract directly. A test that passes because old and new paths both work is not sufficient.
- UI must expose canonical product controls and Chinese copy. It must not hide incomplete implementation behind old labels, disabled-but-clickable controls, mock state, or vague fallback errors.
- Env/startup flows must have one canonical path per mode. Old `.env`, command aliases, or special acceptance flags must either be removed or documented as explicit test-only setup, not production behavior.

### 4. Validation & Error Matrix

| Condition | Required result | Forbidden result |
| --- | --- | --- |
| API receives old field name after canonical schema changed | 400 or ignored with documented error semantics | Silently map old field and claim full implementation |
| DB contains old temporary tag/field | Migration/bootstrap converts it to canonical data | Runtime reads both old and new forever |
| Runtime worker lacks required canonical env | Explicit unavailable/error event | Fall back to fake/script/minimal executor |
| UI still depends on old entry point | Remove or replace with canonical control | Keep both paths and let either one pass acceptance |
| Test uses old payload but passes | Test fails or is rewritten | Treat as compatibility coverage |
| Implementation cannot complete canonical behavior yet | Mark as not implemented / not accepted | Add fallback branch to make the flow look successful |

### 5. Good/Base/Bad Cases

- Good: A schema change adds `role_agents.runtime_type`; bootstrap converts legacy runtime tags once; `/api/chat` only reads `runtime_type`; tests prove `capabilities=['runtime:codex']` is rejected or ignored as product data.
- Base: A legacy user row cannot be safely normalized; the UI/API returns a Chinese configuration error and asks the user to reconfigure the canonical field.
- Bad: Code uses `newField ?? oldField ?? defaultValue` in a P0 runtime path and reports the feature as complete.

### 6. Tests Required

- Unit/API: invalid old payloads fail or are ignored according to the canonical contract.
- Integration: migration/bootstrap converts old data into canonical fields and removes temporary tags.
- Runtime: unavailable canonical runtime/env returns explicit failure, never fake success.
- E2E/UAT: start from the real canonical UI/API entry point; do not use old paths as proof of completion.
- Regression scan: search for old field/tag/command names and verify remaining occurrences are limited to migrations, explicit negative tests, or spec examples.

### 7. Wrong vs Correct

#### Wrong

```typescript
const runtimeType =
  role.runtime_type ??
  (role.capabilities.includes('runtime:codex') ? 'codex' : 'claude_code');
```

#### Correct

```typescript
const runtimeType = role.runtime_type;
if (runtimeType !== 'codex' && runtimeType !== 'claude_code') {
  throw new Error('角色运行时配置无效');
}
```
