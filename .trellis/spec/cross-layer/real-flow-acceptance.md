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
  - 返回字段：`id`, `name`, `role_type`, `capabilities`, `is_orchestrator`。
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

