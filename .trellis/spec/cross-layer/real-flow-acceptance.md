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
- 被 `@` 的自定义角色必须产生一条简短确认消息，表达它理解了任务和准备怎么执行；禁止把确认固定成只有“收到”两个字，也禁止只更新隐藏状态而不在 IM 流里显示角色反馈。

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

## Scenario: OpenCLI Real Browser Acceptance

### 1. Scope / Trigger

- Trigger: Any feature implementation or fix that needs a real browser to verify Web, Desktop, Electron, OAuth/session, DeviceChannel, local runtime, or cross-surface user flow behavior.
- Applies to post-change acceptance, UAT evidence, screenshots, browser-session checks, and any report claiming "真实浏览器已验收".
- Conventional Playwright remains valid for unit-like browser automation, component tests, layout assertions, and deterministic E2E regression, but it is not the default real-browser UAT tool.

### 2. Signatures

- OpenCLI UAT command/session:
  - Target: Web URL, Desktop/Electron entry, or Browser target.
  - Inputs: base URL, reusable browser state when applicable, test user/session source, runtime/worker prerequisites, screenshot path.
  - Outputs: action log, screenshot/video evidence when available, explicit pass/fail/blocked status.
- Report fields:
  - `tool=opencli`
  - `target=<web|desktop|electron|browser>`
  - `url_or_entry=<real entry>`
  - `auth_state=<fixture|real-login|manual-handoff|not-needed>`
  - `evidence=<screenshot/log/artifact path>`
  - `result=<passed|failed|blocked|not-run>`

### 3. Contracts

- If a test requires a real browser, use OpenCLI first. Do not replace it with ad hoc Playwright unless OpenCLI is unavailable or the task is explicitly a Playwright regression test.
- OpenCLI must start from the same real product entry a user would use: no direct internal route, no mocked API route, no hidden test-only DOM shortcut.
- Authentication-sensitive flows may use a documented fixture only after login/session scope is declared; external login or sensitive permission steps must be marked as manual handoff when needed.
- A conventional Playwright run can support the evidence, but the acceptance report must distinguish `Playwright regression passed` from `OpenCLI real-browser UAT passed`.
- If OpenCLI cannot run, the report must say `OpenCLI not run` and mark real-browser acceptance as blocked or not covered.

### 4. Validation & Error Matrix

| 条件 | 必须结果 | 禁止结果 |
| --- | --- | --- |
| 功能改动需要真实浏览器验收 | 使用 OpenCLI 跑真实入口并记录证据 | 只跑常规 Playwright 后写“真实浏览器通过” |
| OpenCLI 未登录或缺少权限 | 记录 manual handoff / blocked | 把跳过的登录合并进 passed |
| OpenCLI 不可用 | 写明原因和未覆盖范围 | 用截图存在或 `playwright --list` 顶替 |
| Playwright 回归通过但未跑 OpenCLI | 报告为回归通过、UAT 未验收 | 报告为完整验收通过 |
| 真实入口失败但内部测试入口通过 | 真实验收失败 | 以内部门户通过关闭任务 |

### 5. Good/Base/Bad Cases

- Good: 功能改完后，OpenCLI 打开真实 Web 工作台，使用声明的 auth state 发送消息，截图和 DOM 证据显示刷新后状态仍正确；报告同时列出补充 Playwright 回归命令。
- Base: OpenCLI 因外部 OAuth 需要用户授权而阻塞，报告写 `blocked: manual login required`，不把该链路计入通过。
- Bad: 只运行 `npx playwright test e2e/foo.spec.ts`，然后在验收报告写“真实浏览器 UAT 通过”。

### 6. Tests Required

- OpenCLI UAT: every user-visible feature change that needs real browser behavior must include one OpenCLI run or an explicit blocked/not-run statement.
- Regression: keep Playwright tests for deterministic behavior, layout, screenshot, sensitive text, and no-overlap assertions.
- Evidence assertions: capture the real entry, user action, resulting UI state, refresh/reopen state when relevant, and any DB/API/runtime IDs required by this spec.
- Report assertion: separate OpenCLI UAT result from Playwright regression result; skipped/blocked OpenCLI cannot be counted as passed.

### 7. Wrong vs Correct

#### Wrong

```text
验收通过：npx playwright test e2e/workspace.spec.ts 通过，截图存在。
```

#### Correct

```text
真实浏览器验收：
- OpenCLI：target=web，url=http://localhost:3000/workspace/...，auth_state=fixture，result=passed，evidence=...
- Playwright 回归：npx playwright test e2e/workspace.spec.ts，exit 0。
- 限制：未覆盖外部 OAuth 人工登录；该项不计入 passed。
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

## Scenario: Serial Role Activation In One Workspace

### 1. Scope / Trigger

- Trigger: Any implementation of multi-role `@` mention, Orchestrator planning, role acknowledgment, handoff, or role execution in the same workspace.
- Applies to Web chat UI, `/api/chat`, plan nodes, role mailbox/handoff state, runtime worker dispatch, `messages` persistence, and acceptance tests.
- P0 decision: role messages may show multiple roles being mentioned, but only one role may be actively doing work in a workspace at a time.

### 2. Signatures

```typescript
type RoleActivationState =
  | 'mentioned'
  | 'acknowledged'
  | 'queued'
  | 'active_reading'
  | 'active_writing'
  | 'active_approval_wait'
  | 'submitted'
  | 'completed'
  | 'blocked';

interface RoleAcknowledgementMessage {
  sessionId: string;
  roleAgentId: string;
  planNodeId?: string;
  content: string;
  metadata: {
    kind: 'role_acknowledgement';
    roleActivationState: 'acknowledged';
    understoodTask: string;
    intendedAction: string;
  };
}

interface WorkspaceRoleLease {
  workspaceId: string;
  activeRoleAgentId: string | null;
  activePlanNodeId?: string | null;
  state: Extract<RoleActivationState, 'active_reading' | 'active_writing' | 'active_approval_wait'> | 'idle';
}
```

### 3. Contracts

- Role Agents are user-defined. Do not hardcode `前端工程师` or `后端工程师` as product roles; those are seed/example roles only.
- When Orchestrator mentions multiple roles, each mentioned role may emit a short acknowledgement message that says it understands the task and gives a minimal execution intent.
- Acknowledgement text must be role-specific and task-aware, for example: `收到，我会先检查现有 API 路由规范，等待 Orchestrator 分配执行。`
- Only Orchestrator or the scheduler may move a role from `queued` into an `active_*` state.
- In P0, a workspace has a single active role lease. No second role may enter `active_reading`, `active_writing`, or `active_approval_wait` until the current active role reaches `submitted`, `completed`, or `blocked`.
- Permission prompts must remain structured Approval/Action UI. Role acknowledgement messages must not ask the user to grant permissions in plain Markdown text.

### 4. Validation & Error Matrix

| Condition | Required result | Forbidden result |
| --- | --- | --- |
| Multiple roles are mentioned | Each relevant role may persist a task-aware acknowledgement, then enters `queued` | Roles start reading/writing concurrently in the same workspace |
| A second role tries to become active while lease is held | Reject or keep `queued`; emit visible waiting state | Silent concurrent execution |
| Role acknowledgement content is empty or only `收到` | Regenerate or reject as insufficient acknowledgement | Treat as completed role feedback |
| Role needs a permission grant | Create structured Approval/Action request | Ask for permission only inside ordinary chat text |
| Current active role blocks | Orchestrator marks it `blocked` and decides retry/skip/next role | Scheduler activates another role without recording the block |

### 5. Good/Base/Bad Cases

- Good: User asks `@Orchestrator` to implement a feature; Orchestrator mentions two custom roles; both roles write brief acknowledgement messages; role A becomes `active_reading`; role B remains `queued`; role B becomes active only after role A submits.
- Base: A role acknowledges but runtime is unavailable; Orchestrator records the role as `blocked` with a visible Chinese reason and does not fake completion.
- Bad: Two role workers read/write the same workspace concurrently because both were mentioned in one user message.
- Bad: The UI only shows a hidden status chip for role receipt and no IM message from the mentioned role.

### 6. Tests Required

- API/integration: multi-role mention persists one acknowledgement message per mentioned role with `metadata.kind='role_acknowledgement'` and non-empty `understoodTask` / `intendedAction`.
- Scheduler: while a `WorkspaceRoleLease` is active, a second role cannot enter any `active_*` state.
- UI: message list shows the role acknowledgement as a real role message with role badge/name, not only a task-card status.
- Approval: permission-required work creates a structured approval card/request; tests must assert the approval source is `plan`, `action`, `permission_escalation`, or `retry`.
- Refresh: after reload, acknowledgements, queued state, active/blocked state, and role badges recover from durable data.

### 7. Wrong vs Correct

#### Wrong

```text
@前端工程师: 收到
@后端工程师: 收到
```

Problem: the messages do not prove the roles understood their work, and they do not show Orchestrator-controlled execution state.

#### Correct

```text
@界面实现: 收到，我会按现有 ChatPanel 组件规范检查消息渲染，等待 Orchestrator 分配执行。
@接口实现: 收到，我会检查 /api/chat 和角色状态契约，等待 Orchestrator 分配执行。
```

Then the scheduler records:

```typescript
workspaceRoleLease = {
  workspaceId,
  activeRoleAgentId: uiRoleId,
  activePlanNodeId: uiPlanNodeId,
  state: 'active_reading',
};
```

## Scenario: Git Diff And Change Actions Surface

### 1. Scope / Trigger

- Trigger: Any implementation that claims to support `get diff`, change review, staging, unstaging, reverting/discarding workspace changes, or "undo latest staged/local change" controls.
- Applies to Web change panel, Desktop local workspace bridge, `/api/git/*` or equivalent route handlers, Action/Approval cards, git command execution, and UAT evidence.
- Reference implementations to reuse first:
  - `refer_proj/zhukunpenglinyutong__desktop-cc-gui/src/services/tauri.ts` and `src-tauri/src/git/commands.rs` for status/diff/stage/unstage/revert command shape.
  - `refer_proj/siteboon__claudecodeui/server/routes/git.js` and `src/components/git-panel/` for Web API/UI flow.
  - `refer_proj/j3n5en__EnsoAI/src/main/services/git/GitService.ts` for path traversal, symlink, binary, and staged/unstaged file diff handling.

### 2. Signatures

```typescript
type GitFileStatusCode = 'M' | 'A' | 'D' | 'U' | 'R' | 'T';
type GitChangeSection = 'staged' | 'unstaged' | 'untracked';

interface GitStatusSnapshot {
  isGitRepository: boolean;
  branchName: string;
  files: GitFileStatus[];
  stagedFiles: GitFileStatus[];
  unstagedFiles: GitFileStatus[];
  totalAdditions: number;
  totalDeletions: number;
}

interface GitFileStatus {
  path: string;
  status: GitFileStatusCode | string;
  additions: number;
  deletions: number;
  section?: GitChangeSection;
}

interface GitFileDiffRequest {
  workspaceId: string;
  path: string;
  staged?: boolean;
}

interface GitFileDiffResponse {
  path: string;
  diff?: string;
  oldContent?: string;
  currentContent?: string;
  isBinary?: boolean;
  isDeleted?: boolean;
  isUntracked?: boolean;
  truncated?: boolean;
}

type GitChangeAction =
  | 'stage_file'
  | 'stage_all'
  | 'unstage_file'
  | 'unstage_all'
  | 'discard_file'
  | 'discard_all'
  | 'revert_latest_local_commit';
```

Minimum API/bridge surface:

- `GET /api/git/status?workspaceId=...`
- `GET /api/git/diff?workspaceId=...&path=...&staged=true|false`
- `POST /api/git/stage-file`
- `POST /api/git/stage-all`
- `POST /api/git/unstage-file`
- `POST /api/git/unstage-all`
- `POST /api/git/discard-file`
- `POST /api/git/discard-all`
- `POST /api/git/revert-latest-local-commit`

### 3. Contracts

- "Get diff" is a change review surface, not only a raw diff string. It must include status grouping, per-file diff, staged/unstaged distinction, and actions to stage, unstage, discard/revert, and refresh state.
- Path inputs must be repository-relative and validated against the workspace root or repository root. Reject path traversal, NUL bytes, and symlink discard/diff paths that cannot be safely read.
- Staged diff uses index vs `HEAD` (`git diff --cached` or equivalent). Unstaged diff uses worktree vs index (`git diff`). Untracked files render as full-file additions when safe.
- Stage file should use `git add -A -- <path>` or equivalent so rename/delete pairs move together. Unstage file should use `git restore --staged -- <path>` or `git reset HEAD -- <path>` consistently.
- Discard/revert is destructive. It must require a structured `Approval`/`Action` confirmation unless the user's policy explicitly allows this action. Do not ask for discard approval only in chat text.
- Discard tracked changes should restore both index/worktree when requested; discard untracked files should delete only after path validation and explicit confirmation.
- UI must refresh status/diff after every stage/unstage/discard action and keep large diffs bounded/truncated so the tab remains responsive.

### 4. Validation & Error Matrix

| Condition | Required result | Forbidden result |
| --- | --- | --- |
| Workspace is not a git repository | `isGitRepository=false` or 400 with Chinese explanation | Empty success that looks like no changes |
| Path is outside workspace/repo root | 400 / rejected action | Running git/fs command on resolved external path |
| File is symlink and action is discard/read unsafe | Reject with explicit error | Follow symlink and mutate/read outside root |
| File is binary | Return `isBinary=true` and no raw text diff | Render binary bytes in UI |
| Untracked file diff requested | Render full-file additions or directory warning | Return empty diff and hide the file |
| Discard file/all requested | Structured Approval/Action required | Silent destructive git restore/clean |
| Large diff requested | Truncate/virtualize with visible notice | Freeze UI rendering all lines |

### 5. Good/Base/Bad Cases

- Good: UI shows staged and unstaged groups, expands a file diff, stages one file, refreshes the file from unstaged to staged, then allows unstage with another refresh.
- Good: User requests discard for a tracked file; system shows an Approval card explaining affected path and command category; only after approval runs restore/clean.
- Base: Non-git workspace shows a clear Chinese "not a git repository" state and hides stage/discard buttons.
- Bad: Only renders `git diff` text and calls the feature complete without stage/unstage/discard controls.
- Bad: `discard_all` runs without approval because it is "just a simple git operation".

### 6. Tests Required

- Unit/API: status splits staged, unstaged, and untracked files correctly.
- Unit/API: staged and unstaged diff use different sources and return different content when a file has both index and worktree changes.
- Security: path traversal, NUL path, unsafe symlink, and binary file cases are rejected or represented safely.
- Action/Approval: discard file/all and revert latest local commit create structured confirmation before execution.
- UI/E2E: stage, unstage, discard, and refresh are visible and update the DOM; large diff shows a truncation notice.
- Regression: untracked file diff renders additions; deleted file diff renders deletions.

### 7. Wrong vs Correct

#### Wrong

```typescript
const diff = await exec(`git diff ${path}`);
return { diff };
```

#### Correct

```typescript
const status = await gitStatus(workspaceId);
const diff = await gitFileDiff({ workspaceId, path, staged });
const approval = action === 'discard_file'
  ? await createApproval({ sourceType: 'action', riskLevel: 'high', sourceId: actionId })
  : null;
return { status, diff, approval };
```
