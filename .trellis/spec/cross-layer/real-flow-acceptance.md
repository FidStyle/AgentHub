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

## Scenario: Plan Node Terminal Queue Consistency

### 1. Scope / Trigger

- Trigger: 修改 plan node control、mailbox dispatch、runtime worker terminal update、plan progress auto-advance、retry/resume/requeue/cancel API。
- Applies to: `plan_nodes`, `plan_node_attempts`, `agent_mailbox_items`, `/api/plan-nodes/:id/{retry,resume,requeue,cancel}`, `/api/mailbox/dispatch-ready`, and runtime worker terminal state.

### 2. Signatures

- `plan_nodes.status`: terminal values include `completed`, `failed`, `cancelled`, `skipped`, `blocked`.
- `plan_node_attempts.status`: queue-active values are `queued`, `running`, `waiting`; terminal values include `completed`, `failed`, `cancelled`, `dead_letter`.
- `agent_mailbox_items.status`: queue-active values are `queued`, `running`, `waiting`; terminal values include `completed`, `failed`, `cancelled`, `dead_letter`.
- `POST /api/plan-nodes/:id/resume|retry|requeue` must supersede same-node `queued` and `waiting` attempts/mailbox items before creating the new queued attempt/mailbox.
- `POST /api/mailbox/dispatch-ready` must not dispatch a mailbox whose plan node is already terminal.

### 3. Contracts

- A completed plan node must not leave same-node `queued` or `waiting` attempts/mailbox items that can still block the target role queue or be dispatched later.
- Runtime terminal completion for an approved action or runtime node must close stale same-node `queued`/`waiting` attempts and mailbox items after setting `plan_nodes.status='completed'`.
- Retry/resume/requeue is a superseding control action. It must mark old same-node `queued`/`waiting` attempts/mailbox items `cancelled` with an explanatory error before inserting the replacement attempt/mailbox.
- Dispatch-ready must reconcile terminal plan nodes before selecting ready mailbox items. If the mailbox's plan node is terminal, update mailbox and linked attempt to the equivalent terminal status instead of dispatching it.
- UI and Mobile/PWA plan supervision must be internally consistent: a row may not show `plan completed` while the latest visible same-node attempt/mailbox remains `queued` or `waiting`.

### 4. Validation & Error Matrix

| 条件 | 必须结果 | 禁止结果 |
| --- | --- | --- |
| Plan node is `completed`, old mailbox is `queued` | Dispatch-ready marks mailbox/attempt `completed` and dispatches nothing | Runtime starts old queued work |
| Plan node is `completed`, old mailbox is `waiting` | Dispatch-ready marks mailbox/attempt `completed` | Same role queue remains blocked forever |
| User calls `resume` on a waiting node | Old queued/waiting attempts/mailbox become `cancelled`; new attempt/mailbox is `queued` | Old waiting mailbox continues to block selector |
| Approved action completes a plan node | Runtime worker marks node `completed` and closes stale queued/waiting queue rows | UI shows 4/4 completed with latest attempt `queued` |
| Action rejected by approval API | Action stays `rejected`; plan node can be resumed/retried through plan-node control | Direct DB mutation to bypass rejection |

### 5. Good/Base/Bad Cases

- Good: Final architect node completes; `plan_nodes.status=completed`; all same-node attempts/mailbox are `completed` or `cancelled`; Web and Mobile show 4/4 completed without queued leftovers.
- Base: A permission boundary leaves a node `waiting`; user approves and continuation completes; runtime worker closes the original waiting attempt/mailbox.
- Bad: Final node completes through an older attempt while a newer resume attempt remains `queued`; UI says plan completed but dispatch-ready later runs the stale queued item.

### 6. Tests Required

- Runtime worker test: an approved action with `planNodeId` completing must update stale same-node `queued` and `waiting` attempts/mailbox rows.
- Plan-node control test: `retry` and `resume` must cancel old same-node `queued`/`waiting` work before inserting a new attempt/mailbox.
- Mailbox dispatch test/API UAT: dispatch-ready must reconcile terminal plan-node leftovers and return `dispatched: []` when no real queued work remains.
- OpenCLI UAT: Web changes/orchestrator panel and Mobile/PWA plan supervision must both show terminal consistency after refresh.

### 7. Wrong vs Correct

#### Wrong

```text
Plan shows completed, but latest attempt line still says "attempt queued · mailbox queued"; dispatch-ready can later run the stale mailbox.
```

#### Correct

```text
Plan shows completed; stale queued/waiting attempts and mailbox items for terminal nodes are completed/cancelled before UI readback and before dispatch-ready selection.
```

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

## Scenario: Chat Deployment Local Manifest Closure

### 1. Scope / Trigger

- Trigger: 修改 `/api/chat`、action approval/dispatch、deployment action、artifact panel、Mobile/PWA action readback 或 workspace file preview，使用户能在聊天中发起“部署当前网站”。
- Applies to: `actions`, `messages`, `artifacts`, workspace root 文件系统、Web chat permission card、Artifact panel、Mobile/PWA `/m/sessions/:sessionId`。

### 2. Signatures

- `POST /api/chat`
  - 用户消息包含部署意图，例如 `部署当前网站`、`发布当前项目`。
  - Response SSE 必须发出 `approval_requested`，不能直接返回部署成功。
- `actions`
  - `action_type = "deploy"`
  - `requires_approval = true`
  - `risk_level = "high"`
  - `status = pending | rejected | approved | completed | failed`
  - `result.source = "chat_deploy_request"`
- `dispatchApprovedAction(db, action)`
  - 对 `deploy` action 生成 workspace-local manifest。
- `artifacts`
  - `metadata.kind = "deployment"`
  - `metadata.actionId`
  - `metadata.previewPath`
  - `metadata.manifestPath`
  - `metadata.entryPath`
  - `metadata.fileCount`

### 3. Contracts

- 部署意图必须进入产品审批链路；拒绝前不得执行部署，不得创建 deployment artifact。
- 允许后必须只在 selected workspace root 内写入 `.agenthub/deployments/<actionId>/manifest.json`。
- 本地 manifest 闭环允许作为 P1 部署结果，但必须是真实文件 + DB artifact/message/action 三方可读回。
- `previewPath` 必须是可解释的稳定引用，例如 `workspace-file:<workspaceId>:public/index.html`；没有 HTML 时可 fallback 到 manifest 或 README，但不得返回空成功。
- 部署 result card message 必须持久化，刷新后 Web chat 可以读回。
- Mobile/PWA durable action readback 必须显示 deploy action 的 `previewPath`、`manifestPath`、`artifactId`。

### 4. Validation & Error Matrix

| 条件 | 必须结果 | 禁止结果 |
| --- | --- | --- |
| 聊天内容命中部署意图 | 创建 pending `deploy` action + approval message | 直接生成成功文案 |
| 用户拒绝 deploy action | `actions.status=rejected`，不写 manifest，不创建 deployment artifact | 拒绝后仍出现部署 artifact |
| 用户允许 deploy action | 校验 workspace root，写 manifest，创建 artifact/result message，action completed | 写到 AgentHub 宿主 repo 或只改 React state |
| workspace root 缺失 | action failed，中文错误 | 猜测 `process.cwd()` |
| 入口文件不存在 | manifest 使用安全 fallback 并记录 entry/preview | `previewPath` 为空仍标 completed |
| Mobile/PWA 刷新 | durable action 显示 preview/manifest/artifact | 只显示 pending message runtimeParts |

### 5. Good/Base/Bad Cases

- Good: 用户发送“请部署当前网站” -> pending deploy action -> 拒绝后 artifact count 仍为 0；再次发送 -> 允许 -> `.agenthub/deployments/<actionId>/manifest.json` 存在，artifact `metadata.kind=deployment`，Mobile 显示预览和 Manifest。
- Base: workspace 没有 `public/index.html`，但有 `README.md`；manifest preview fallback 到可读文件并记录实际 entry。
- Bad: `/api/chat` 收到部署意图后直接插入“部署完成”助手消息，没有 action、approval、manifest 或 artifact。

### 6. Tests Required

- Unit/API: `/api/chat` 部署意图创建 pending deploy action、approval message，且不调用 runtime、不创建 artifact。
- Unit/API: rejected deploy action 不产生 manifest/artifact。
- Unit/API: approved deploy action 写 manifest、创建 deployment artifact、result card message，并更新 action completed。
- UI/OpenCLI: Web 走拒绝和允许两段；Artifact panel 刷新读回 deployment artifact。
- UI/OpenCLI: Mobile/PWA `/m/sessions/:sessionId` 读回 deploy completed/rejected、previewPath、manifestPath、artifactId。

### 7. Wrong vs Correct

#### Wrong

```typescript
if (content.includes('部署')) {
  await db.from('messages').insert({ content: '部署完成' })
}
```

#### Correct

```typescript
const action = await createDeployApproval({ workspaceId, sessionId, workspaceRoot })
// SSE: approval_requested
// After approval: dispatchApprovedAction writes manifest, artifact, result message, and completed action.
```

## Scenario: Rich Document And Presentation Artifacts

### 1. Scope / Trigger

- Trigger: 添加或修改富文档、演示稿、PPT、DOCX、Artifact 编辑、Artifact 导出能力。
- Applies to: `artifacts.artifact_type`, `/api/artifacts`, `/api/artifacts/:id`, `/api/artifacts/:id/download`, Web `ArtifactPanel`, workspace file preview, and any helper used by both API routes and client components.

### 2. Signatures

- DB: `artifacts.artifact_type` must include `document` and `presentation` when those product types are supported.
- `POST /api/artifacts`
  - Request: `workspace_id`, `session_id?`, `title?`, `artifact_type=document|presentation`, `content?`, `metadata?`.
  - Response: durable artifact row with `content` initialized when omitted.
- `PATCH /api/artifacts/:id`
  - Request: `title`, `content?`, `artifact_type?`, `metadata?`, `edit_request?`.
  - Response: updated durable artifact row.
- `GET /api/artifacts/:id/download`
  - `document` returns DOCX MIME.
  - `presentation` returns PPTX MIME.

### 3. Contracts

- `document.content` is editable source Markdown.
- `presentation.content` is a JSON deck model with `version`, `title`, and `slides[]`.
- `edit_request.instruction` must be recorded durably, normally under artifact metadata or a future revisions/edit-request table.
- Client components may import only client-safe artifact model helpers. Node-only OpenXML/zip/export helpers must live in server-only modules used by API routes.
- Workspace `.docx/.pptx` files may be classified as document/presentation artifacts, but if no editable source exists the UI must clearly show download-only status.

### 4. Validation & Error Matrix

| 条件 | 必须结果 | 禁止结果 |
| --- | --- | --- |
| Missing `workspace_id` | 400 中文错误 | 创建前端本地假 artifact |
| Session 不属于 workspace | 403 中文错误 | 跨 workspace 写入 artifact |
| Empty PATCH title | 400 `产物名称不能为空` | 保存空标题 |
| Non-string content | 400 `产物内容必须是文本` | 写入 object 后让 UI 猜格式 |
| Empty edit request | 400 `修改要求不能为空` | 记录空二次编辑意图 |
| Client imports export helper with `node:*`/`Buffer` | build fails and must be fixed by split module | 在 client bundle polyfill Node-only code |

### 5. Good/Base/Bad Cases

- Good: Web 创建演示稿 artifact -> DB row `artifact_type=presentation` + JSON content -> right panel previews slides -> PATCH 保存 -> download returns PPTX zip.
- Base: Workspace 中已有 `.pptx` 文件 -> 标记为 `presentation` artifact -> UI shows download-only message when no editable JSON source exists.
- Bad: Button creates a React-only slide preview with no `/api/artifacts` row, then reports PPT artifact complete.

### 6. Tests Required

- Unit: presentation JSON parse/default serialization and DOCX/PPTX export returns OpenXML zip bytes.
- API: create document/presentation artifact; PATCH content and edit request; download MIME and zip signature.
- Type/build: `pnpm --filter @agenthub/web build` must pass so client/server helper boundaries are verified.
- UI/E2E when claiming browser acceptance: create, preview, edit, save, reload, and download from the real Web workspace entry.

### 7. Wrong vs Correct

#### Wrong

```typescript
// Client component imports a helper that also exports Buffer/node:path based code.
import { defaultPresentationDeck, createPptxBuffer } from '@/lib/artifacts/rich-artifacts'
```

#### Correct

```typescript
// Client-safe model helpers.
import { defaultPresentationDeck } from '@/lib/artifacts/rich-artifacts'

// Server-only route helper.
import { createPptxBuffer } from '@/lib/artifacts/rich-artifact-export'
```

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
- Applies to post-change acceptance, UAT evidence, screenshots, browser-session checks, tri-surface acceptance, and any report claiming "真实浏览器已验收".
- Conventional Playwright remains valid for unit-like browser automation, component tests, layout assertions, and deterministic E2E regression, but it is not the default real-browser UAT tool.

### 2. Signatures

- OpenCLI UAT command/session:
  - Target: Web URL, Desktop/Electron entry, or Browser target.
  - Inputs: base URL, reusable browser state when applicable, test user/session source, runtime/worker prerequisites, screenshot path.
  - Outputs: action log, screenshot/video evidence when available, explicit pass/fail/blocked status.
- Report fields:
  - `tool=opencli`
  - `target=<web|mobile_browser|pwa|desktop|electron|browser>`
  - `url_or_entry=<real entry>`
  - `surface=<web|mobile_pwa|desktop_electron>`
  - `auth_state=<fixture|real-login|manual-handoff|not-needed>`
  - `evidence=<screenshot/log/artifact path>`
  - `result=<passed|failed|blocked|not-run>`

- Tri-surface acceptance report:
  - `web.result=<passed|failed|blocked|not-run|not-applicable>`
  - `mobile_pwa.result=<passed|failed|blocked|not-run|not-applicable>`
  - `desktop_electron.result=<passed|failed|blocked|not-run|not-applicable>`
  - `surface_decision=<changed|inspected-no-change|not-applicable>` for each surface.

### 3. Contracts

- Every AgentHub feature task must start from tri-surface acceptance planning: Web, Mobile browser/PWA, and Desktop/Electron are all in scope by default. A surface can be marked `not-applicable` only with a product reason tied to FR-ID/surface ownership. `not-run`, `blocked`, skipped login, missing worker, missing Electron build, or missing mobile viewport evidence are not passing evidence.
- If a test requires a real browser, use OpenCLI first. Do not replace it with ad hoc Playwright unless OpenCLI is unavailable or the task is explicitly a Playwright regression test.
- OpenCLI is the preferred real UI tool for Web browser, Mobile browser/PWA viewport, and Electron/Desktop UAT. Use a mobile browser/PWA viewport for Mobile acceptance unless the task specifically requires native RN device/simulator behavior; native RN gaps must be listed separately and not counted as passed.
- OpenCLI must start from the same real product entry a user would use: no direct internal route, no mocked API route, no hidden test-only DOM shortcut.
- Authentication-sensitive flows may use a documented fixture only after login/session scope is declared; external login or sensitive permission steps must be marked as manual handoff when needed.
- Multi-worktree acceptance must record the current `location.href` in OpenCLI evidence and verify the port matches the lane's explicit fixed port. If OpenCLI state is still on another worktree or old port, navigate to the correct entry and recapture state, DOM, and screenshots before making any pass/fail claim.
- When OAuth/GitHub login is not the behavior under test and local OAuth config is missing, a documented acceptance session fixture may be used. The report must set `auth_state=fixture` and still exercise the real DB/API/UI path; fixtures must not create fake business results or mock product APIs.
- A conventional Playwright run can support the evidence, but the acceptance report must distinguish `Playwright regression passed` from `OpenCLI real-browser UAT passed`.
- If OpenCLI cannot run, the report must say `OpenCLI not run` and mark real-browser acceptance as blocked or not covered.
- A task is not complete until the tri-surface report is updated. If one surface fails, stop the queue and split a fix/verification child task in the same feature area; do not continue to the next feature.

### 4. Validation & Error Matrix

| 条件 | 必须结果 | 禁止结果 |
| --- | --- | --- |
| 任务验收缺 Web/Mobile/Electron 任一端决策 | 标记任务未完成，补 surface decision | 只写“Web 已过，因此完成” |
| Mobile 只跑桌面宽度浏览器 | 重跑 OpenCLI mobile/PWA viewport 或标 `not-run` | 把桌面 Web 截图计入 Mobile 通过 |
| Electron/Desktop 只跑 renderer unit test | 标为 regression passed、Electron UAT not-run | 写 Desktop/Electron 真实验收通过 |
| 功能改动需要真实浏览器验收 | 使用 OpenCLI 跑真实入口并记录证据 | 只跑常规 Playwright 后写“真实浏览器通过” |
| OpenCLI 未登录或缺少权限 | 记录 manual handoff / blocked | 把跳过的登录合并进 passed |
| OpenCLI 不可用 | 写明原因和未覆盖范围 | 用截图存在或 `playwright --list` 顶替 |
| Playwright 回归通过但未跑 OpenCLI | 报告为回归通过、UAT 未验收 | 报告为完整验收通过 |
| 真实入口失败但内部测试入口通过 | 真实验收失败 | 以内部门户通过关闭任务 |
| OpenCLI state 显示旧端口或其他 worktree | 导航到本 lane 显式固定端口并重新抓取 state/DOM/screenshot | 沿用旧端口截图声明当前 worktree 通过 |
| OAuth client 未配置但任务不验证 OAuth 本身 | 使用 documented acceptance fixture 并声明 `auth_state=fixture` | 收集凭证，或把 fixture 登录写成真实 OAuth 通过 |

### 5. Good/Base/Bad Cases

- Good: 任务报告列出 Web、Mobile/PWA、Electron 三行 surface matrix；Web 和 Mobile 用 OpenCLI 浏览器不同视口，Electron 用 OpenCLI Electron/Desktop entry，三端都验证同一 workspace/session 状态可刷新读回。
- Good: 功能改完后，OpenCLI 打开真实 Web 工作台，使用声明的 auth state 发送消息，截图和 DOM 证据显示刷新后状态仍正确；报告同时列出补充 Playwright 回归命令。
- Good: `opencli browser agenthub open http://localhost:3107` 后先保存 state；若 state 仍在旧端口，先导航到 `localhost:3107`，再重抓 DOM/screenshot 并确认 `location.href`。
- Base: 纯后端 helper 不改变用户可见 UI，报告仍列三端为 `inspected-no-change` 或 `not-applicable`，并说明无 Web/Mobile/Electron 行为变化。
- Base: OpenCLI 因外部 OAuth 需要用户授权而阻塞，报告写 `blocked: manual login required`，不把该链路计入通过。
- Bad: 只跑 Web OpenCLI 后把 “Mobile 同 Web 代码” 当 Mobile 通过，没有移动视口或 PWA 状态证据。
- Bad: 只运行 `npx playwright test e2e/foo.spec.ts`，然后在验收报告写“真实浏览器 UAT 通过”。
- Bad: OpenCLI 打开目标 URL 返回成功，但 `state` 实际显示另一个端口；继续截图并把该截图当成当前 worktree 证据。

### 6. Tests Required

- Tri-surface matrix: every task must record Web, Mobile browser/PWA, and Desktop/Electron as `changed`, `inspected-no-change`, or `not-applicable`, with result and evidence for each.
- OpenCLI UAT: every user-visible feature change that needs real browser behavior must include one OpenCLI run or an explicit blocked/not-run statement.
- Mobile/PWA UAT: if Mobile is user-visible for the feature, run OpenCLI browser/PWA at a mobile viewport and assert no horizontal overflow, no overlapping controls, correct Chinese status text, and refresh/readback where state is involved.
- Electron UAT: if Desktop/Electron is user-visible for the feature, run OpenCLI against the Electron/Desktop entry where available; if OpenCLI cannot drive Electron, record the blocker and use Playwright Electron only as supplemental regression evidence.
- Regression: keep Playwright tests for deterministic behavior, layout, screenshot, sensitive text, and no-overlap assertions.
- Evidence assertions: capture the real entry, user action, resulting UI state, refresh/reopen state when relevant, and any DB/API/runtime IDs required by this spec.
- Report assertion: separate OpenCLI UAT result from Playwright regression result; skipped/blocked OpenCLI or any missing surface cannot be counted as passed.

### 7. Wrong vs Correct

#### Wrong

```text
验收通过：npx playwright test e2e/workspace.spec.ts 通过，截图存在。
```

#### Correct

```text
真实浏览器验收：
- OpenCLI：target=web，surface=web，url=http://localhost:3000/workspace/...，auth_state=fixture，result=passed，evidence=...
- OpenCLI：target=mobile_browser，surface=mobile_pwa，viewport=390x844，result=passed，evidence=...
- OpenCLI：target=electron，surface=desktop_electron，entry=apps/desktop，result=passed，evidence=...
- Playwright 回归：npx playwright test e2e/workspace.spec.ts，exit 0。
- 限制：未覆盖外部 OAuth 人工登录；该项不计入 passed。
```

## Scenario: Workspace Mini IDE Patch Review Flow

### 1. Scope / Trigger

- Trigger: Web Workspace exposes file editing, selected-context patch drafts, apply/reject review, or Git commit history.
- Applies to `apps/web/lib/workspace/cloud-workspace-fs.ts`, `apps/web/app/api/workspaces/[id]/files/*`, `apps/web/app/api/workspaces/[id]/git/*`, and right-panel file/change UI.

### 2. Signatures

- `POST /api/workspaces/:workspaceId/files/patch`
  - Draft request: `{ path: string, selectionStart: number, selectionEnd: number, replacement: string, apply?: false }`
  - Apply request: `{ path: string, selectionStart: number, selectionEnd: number, expectedText: string, replacement: string, apply: true }`
  - Draft response: `{ draft: { path, selectionStart, selectionEnd, selectedText, replacement, content, diff } }`
  - Apply response: `{ ok: true, draft, preview, changes }`
- `GET /api/workspaces/:workspaceId/git/history?limit=<n>`
  - Response: `{ commits: Array<{ hash, shortHash, author, date, message }> }`

### 3. Contracts

- Patch draft must not write files. Only `apply: true` can update workspace content.
- Apply must reread the current file and compare the current selected text with `expectedText`; stale drafts must fail.
- All paths must go through `resolveWorkspacePath` and stay inside the workspace root.
- Editable files are limited to ordinary text/code/markdown-like files and bounded size; binary/image/large files must return a Chinese error.
- Git history must come from real `git log`; empty repositories return `commits: []`, not mock commit rows.
- UI must emit or otherwise trigger workspace file/Git refresh after apply.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Missing auth | Existing auth guard response. |
| Workspace not owned | Existing workspace ownership error. |
| Missing `path` | `400 { error: "path 必填" }` or equivalent Chinese error. |
| Invalid selection range | `400` with Chinese selection error. |
| Path escapes workspace root | `400` with workspace boundary error. |
| Binary/image/large file | `400` with Chinese unsupported-edit error. |
| Stale selected text on apply | `400 { error: "文件内容已变化，请重新选择后再应用" }`. |
| Empty Git history | `200 { commits: [] }`. |

### 5. Good/Base/Bad Cases

- Good: User opens a cloud workspace text file, selects a range, creates a draft, sees diff, rejects without file changes, then creates/applies another draft and Git status shows the modified file.
- Base: New repository has no commits; history panel shows a Chinese empty state.
- Bad: UI edits local state only, shows a fake diff, or applies a stale selection after the file changed on disk.

### 6. Tests Required

- Unit/helper tests for draft no-write behavior, apply write behavior, stale selection rejection, path boundary rejection, unsupported file types where applicable, and real Git history parsing.
- API tests when route-level auth/ownership fixtures are available.
- UI/E2E or real-browser evidence for the right-panel flow when auth/env fixtures are available: select text, generate diff, reject, apply, verify Git changes refresh.

### 7. Wrong vs Correct

#### Wrong

```typescript
setPreview({ ...preview, content: nextContent })
setGitCommits([{ shortHash: 'demo', message: '示例提交' }])
```

#### Correct

```typescript
await applyWorkspaceSelectionPatch(root, path, start, end, expectedText, replacement)
return NextResponse.json({
  preview: await readCloudWorkspacePreview(root, path),
  changes: await readWorkspaceGitStatus(root),
})
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

## Scenario: Bytedance Fixed-Sample Product Gate

### 1. Scope / Trigger

- Trigger: Any report or task claims the fixed sample `做一个加减乘除的简单网站，使用sqlite存储历史记录` is accepted as a Bytedance product-flow pass.
- Applies to: `/api/chat`, Orchestrator plan creation, plan nodes, mailbox, runtime worker, actions/approvals, workspace files, Git changes, file tree/code references, Web UI, Mobile/PWA readback, and Desktop/Electron supervision.

### 2. Signatures

- User prompt: `做一个加减乘除的简单网站，使用sqlite存储历史记录`
- Required durable rows:
  - `messages.sender_type='agent'` for Orchestrator/architect first response.
  - `plans.status` eventually `completed` or a documented terminal failure.
  - `plan_nodes.label` includes at least architect planning, frontend engineer execution, backend engineer execution when backend storage is required, and architect summary/validation.
  - `agent_mailbox_items` and `plan_node_attempts` exist for assigned worker roles.
  - `actions` rows exist for permission-bound file/tool/git/destructive operations.
- Surface evidence:
  - Web workspace session page.
  - Mobile/PWA `/m/sessions/:sessionId`.
  - Desktop/Electron runtime supervision or fallback smoke when OpenCLI has no app adapter.

### 3. Contracts

- The first assistant-visible response must be an Orchestrator/architect response that plans the task and explicitly assigns the frontend engineer. If SQLite/storage/backend work is required, backend assignment must also be recorded.
- A generated product URL passing is not sufficient. The AgentHub orchestration state must show that assigned roles received durable work, ran through runtime, and handed results back to Orchestrator.
- The final Orchestrator/architect summary or validation must occur after worker nodes complete. If the plan stops at a permission boundary, the report must state `partial` or `blocked`, not `accepted`.
- Permission control must be exercised through real `actions` approval/rejection APIs. Workspace boundary rejections, such as `/tmp` writes outside the selected workspace root, are valid security behavior but do not complete the product gate.
- Git/file tree/code-reference evidence must be user-visible or queryable through AgentHub. At minimum, report file tree/readback paths, relevant changed files, and Git/change status or explicitly mark that portion partial.
- Web, Mobile/PWA, and Desktop/Electron evidence must cover AgentHub state, not only the generated calculator product site.

### 4. Validation & Error Matrix

| Condition | Required result | Forbidden result |
| --- | --- | --- |
| Orchestrator does not reply first | Mark product gate failed/partial | Count worker output as Orchestrator success |
| Frontend node/mailbox missing or waiting | Mark product gate partial | Claim full multi-agent orchestration complete |
| Worker product artifact runs but plan summary is waiting | Product artifact pass, product gate partial | Treat product URL as full AgentHub pass |
| Permission request is rejected for outside-workspace path | Security pass, plan may remain waiting | Weaken workspace isolation to force completion |
| Git/file tree/code reference not verified | Mark that portion partial | Omit it from the acceptance matrix |
| Electron OpenCLI adapter unavailable | Use Playwright Electron fallback and state why | Claim OpenCLI Electron passed without adapter |

### 5. Good/Base/Bad Cases

- Good: Web sends the fixed prompt, Orchestrator replies with a plan assigning frontend/backend, both worker nodes complete, permissions are approved/rejected through real APIs, Git/file tree/code references are readable, architect summary completes, and Web/Mobile/Desktop surfaces all read back the same state.
- Base: Permission continuation bug is fixed and the calculator runs, but frontend/summary nodes remain waiting. Report this as blocker accepted and product gate partial.
- Bad: Run the generated calculator on `localhost`, take Web/Mobile screenshots, and claim Bytedance multi-Agent product flow complete while the AgentHub plan is still waiting.

### 6. Tests Required

- DB/API: query and record `workspaceId`, `sessionId`, `planId`, all `plan_nodes`, `agent_mailbox_items`, `plan_node_attempts`, `actions`, and relevant `messages`.
- Web OpenCLI: screenshot/DOM assertions for Orchestrator plan, worker status, approval cards, file tree/code references, Git/change state, and final summary.
- Mobile/PWA OpenCLI: same session readback includes plan/permission/action state and product artifact link/preview where applicable.
- Desktop/Electron: runtime supervision/build smoke or app-adapter UAT; state explicitly when using fallback.
- Product artifact: calculator API/UI passes add/sub/mul/div, divide-by-zero, invalid input/operator, and SQLite history persistence.

### 7. Wrong vs Correct

#### Wrong

```text
Calculator Web and Mobile UI passed, so fixed sample accepted.
```

#### Correct

```text
Approved-result blocker accepted. Fixed sample product artifact passed.
Bytedance product gate remains partial: frontend plan node is waiting, architect summary is waiting, and Git/code-reference readback was not verified.
```
