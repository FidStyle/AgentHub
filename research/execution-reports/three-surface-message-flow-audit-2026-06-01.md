# 三端真实主链路审计记录（2026-06-01）

本报告只记录真实验收发现，不把组件存在、mock 通过、HTTP 200 或截图本身当作完成证据。验收范围覆盖 Web、Desktop、Mobile，以及云端/本地对话、GitHub 登录态、`@角色`、附件、artifact、工作区创建后的连续流程。

## 环境

- Repo: `/Users/joytion/Documents/code/AgentHub_new_claude_test`
- Branch: `AgentHub_new_claude_test`
- Web: `http://localhost:3000`
- opencli session: `agenthub`
- 登录态：opencli 浏览器复用真实浏览器状态，工作台显示 `登录：joytion`
- Desktop 状态：Web 工作台显示 `Desktop：已连接`、`本地 Runtime：可操作`

## 已记录证据

- `e2e/artifacts/opencli-uat/message-flow-audit/01-workspace-list.png`
- `e2e/artifacts/opencli-uat/message-flow-audit/02-after-cloud-create-list.png`
- `e2e/artifacts/opencli-uat/message-flow-audit/03-cloud-open-no-session.png`
- `e2e/artifacts/opencli-uat/message-flow-audit/04-cloud-session-ready.png`
- `e2e/artifacts/opencli-uat/message-flow-audit/05-cloud-after-send.png`
- `e2e/artifacts/opencli-uat/message-flow-audit/06-local-workspace-list.png`
- `e2e/artifacts/opencli-uat/message-flow-audit/07-local-enter-no-session.png`
- `e2e/artifacts/opencli-uat/message-flow-audit/08-local-after-send-error.png`
- `e2e/artifacts/opencli-uat/message-flow-audit/09-role-picker.png`
- `e2e/artifacts/opencli-uat/message-flow-audit/10-role-after-send.png`
- `e2e/artifacts/opencli-uat/message-flow-audit/11-attachment-after-refresh.png`
- `e2e/artifacts/opencli-uat/message-flow-audit/12-artifact-output-empty.png`
- `e2e/artifacts/opencli-uat/message-flow-audit/13-desktop-main.png`
- `e2e/artifacts/opencli-uat/message-flow-audit/14-desktop-codex-before-send.png`
- `e2e/artifacts/opencli-uat/message-flow-audit/15-desktop-codex-after-send.png`
- `e2e/artifacts/opencli-uat/message-flow-audit/16-mobile-entry.png`
- `e2e/artifacts/opencli-uat/message-flow-audit/17-mobile-playwright-entry.png`
- `e2e/artifacts/opencli-uat/message-flow-audit/18-mobile-approve-loading.png`
- `e2e/artifacts/opencli-uat/message-flow-audit/19-mobile-preview.png`

## Web / Cloud 工作区

### 发现

1. 新建云端工作区后停留在工作区列表，没有自动进入新建工作区。
   - Workspace: `AUDIT-CLOUD-1780308876476`
   - ID: `da3358e1-3fd8-41d2-9dcf-16366afcd4c7`
   - Classification: `partial_shell`
   - Decision: 主流程应从“创建工作区”连续进入可发送状态，或者明确提示下一步。

2. 进入新建云端工作区后没有默认会话，聊天区域显示 `选择一个会话`，侧栏 `暂无数据`，发送入口不可用。
   - Screenshot: `03-cloud-open-no-session.png`
   - Classification: `partial_shell`
   - Decision: P0 主链路不能要求用户猜测必须先点侧栏“新建会话”；需要自动创建/选择会话，或在主区域提供明确 CTA。

3. 手动点击 `新建会话` 后可以输入并发送用户消息，但云端 Runtime 返回不可用。
   - Test prompt: `云端真实发送 AUDIT 1780308985`
   - UI result: 用户消息落屏，系统提示 `公共云端 Runtime 未就绪，请稍后再试或切换到本地 Desktop 运行时`
   - Screenshot: `05-cloud-after-send.png`
   - Classification: `implemented_unverified`
   - Decision: 当前环境只能证明云端失败态有提示，不能证明云端真实 agent 回复、runtime log、artifact 产出。

## 待继续审计

## Web / local_desktop 工作区

### 发现

1. 真实工作区列表显示本地工作区可操作，点击 `连接并继续` 进入 `/workspace/ddfec060-77df-4129-b69f-7a4d3191b7d6?mode=operate`。
   - UI status: `Desktop：已连接`、`本地 Runtime：可操作`、`可操作模式`
   - Screenshot: `06-local-workspace-list.png`
   - Classification: `implemented_unverified`

2. 进入本地工作区后没有默认会话，主区域显示 `选择一个会话`，侧栏 `暂无数据`，发送入口不可用。
   - Screenshot: `07-local-enter-no-session.png`
   - Classification: `partial_shell`
   - Decision: 与云端同类。入口声明可操作，但进入后不是可发送状态。

3. 手动点击 `新建会话` 后输入可用，但发送失败。
   - Test prompt: `本地真实发送 AUDIT 1780310200`
   - UI result: 输入框清空，消息区变成 `加载失败 / 数据获取失败，请重试`
   - Network: `POST /api/chat` 返回 `409`
   - Response body: `{"error":"本地 Desktop 未连接云端，当前只能只读查看历史。"}`
   - DB evidence: `sessions` 有新会话 `f2491df0-549a-40bf-ae46-065dc39d8680`；`messages` 无用户消息；`runtime_sessions` 无记录；`runtime_logs` 无记录。
   - Screenshot: `08-local-after-send-error.png`
   - Classification: `partial_shell`
   - Decision: 页面状态栏和后端发送权限判定冲突。当前不能证明本地 Web -> DeviceChannel -> Desktop runtime 主链路打通。

## 待继续审计

## Web / `@角色`

### 发现

1. UI 可打开 `提及角色`，角色 picker 展示 `@ 架构师`。
   - Role ID: `44ba94c2-599b-4a97-bd46-6a2f5ee1e509`
   - Screenshot: `09-role-picker.png`
   - Classification: `implemented_unverified`

2. 选择 `@架构师` 后发送云端消息，DB 用户消息真实保存 `role_agent_id` 和 `metadata.mentions`。
   - Test prompt: `角色真实发送 AUDIT 1780310500`
   - Message ID: `9a40f582-42d3-47c6-8051-f2c1ee08e285`
   - Session ID: `de0692c9-e81f-45b7-b94b-ac0470946463`
   - DB: `role_agent_id = 44ba94c2-599b-4a97-bd46-6a2f5ee1e509`
   - DB: `metadata.mentions = ["44ba94c2-599b-4a97-bd46-6a2f5ee1e509"]`
   - Runtime: `runtime_sessions.status = failed`
   - UI result: 显示用户消息和 `公共云端 Runtime 未就绪`，没有真实角色回复。
   - Screenshot: `10-role-after-send.png`
   - Classification: `partial_shell`
   - Decision: 角色选择与持久化已发生，但未通过真实 runtime 角色回复、角色上下文产出和 artifact 验收。

## Web / 附件

### 发现

1. opencli 真实 UI 文件上传命令失败，未完成浏览器文件选择器路径验收。
   - Command: `opencli browser agenthub upload ...`
   - Error: `SyntaxError: Identifier 'markerAttr' has already been declared`
   - Classification: `implemented_unverified`
   - Decision: UI 上传交互本轮未验收；需要后续用修复后的 opencli、Playwright 或人工浏览器补测。

2. 使用同一登录态在页面上下文调用 `/api/attachments`，附件内容真实持久化。
   - Attachment ID: `6ac710aa-f930-43d5-8804-06679b4435a3`
   - Token: `ATTACHMENT_AUDIT_TOKEN_1780310600`
   - DB: `messages.metadata.attachment.content` 保存了完整 token 内容
   - DB: `contentRef = message:6ac710aa-f930-43d5-8804-06679b4435a3`
   - Classification: `implemented_unverified`

3. 使用同一登录态调用 `/api/chat` 并携带 `attachmentIds`，用户消息 metadata 保存附件引用，但 runtime 仍失败。
   - Test prompt: `附件真实发送 AUDIT 1780310650`
   - Message ID: `2c84a55f-40df-4761-b146-4e88311a1156`
   - DB: `metadata.attachments[0].contentRef = message:6ac710aa-f930-43d5-8804-06679b4435a3`
   - Runtime session: `205fd79f-a197-42b2-8399-98ba8cd2af2e`
   - Runtime status: `failed`
   - Runtime logs: `gateway_connected` -> `public_runtime_available=false` -> `endpoint_unavailable`
   - Classification: `partial_shell`
   - Decision: 附件内容/引用链路到 chat metadata 成立，但没有验证附件内容进入真实 runtime prompt、agent 回复或 artifact。

4. 刷新工作区后，聊天区不展示附件系统消息或附件上下文；Artifact 上下文仍为 `0 条`。
   - Screenshot: `11-attachment-after-refresh.png`
   - Classification: `partial_shell`
   - Decision: 附件虽在 DB 中作为 pinned system message 存在，但用户刷新后看不到已上传附件上下文，主流程不闭环。

## Web / Artifact

### 发现

1. `产物` 面板可打开，但当前会话显示 `暂无产物`。
   - Screenshot: `12-artifact-output-empty.png`
   - Runtime state: 云端 runtime 未就绪，本地 runtime 被 409 阻断
   - Classification: `partial_shell`
   - Decision: 目前只能证明空态存在，不能证明 artifact 产出、持久化、刷新读回或后续部署消费。

## 待继续审计

## Desktop

### 发现

1. 使用独立 userData 启动开发版 Electron，Desktop 主界面可打开，Runtime 检测可读到本机 Claude Code / Codex。
   - URL: `http://localhost:5178/`
   - UI: `云端连接断开`、`未登录`
   - UI: `Codex 已接入`、`Claude Code 已接入`
   - UI: `Codex 已安装并完成认证`、`Claude Code 已安装并完成认证`
   - Screenshot: `13-desktop-main.png`
   - Classification: `implemented_verified`（仅限 Desktop 本地检测）

2. Desktop 自身的 Codex 轻量会话可真实调用本机 Codex CLI 并获得结果。
   - Test prompt: `Desktop AUDIT 1780311000 请只回复 OK`
   - UI result: 活动记录 `[Codex] Desktop AUDIT 1780311000 请只回复 OK OK`
   - Screenshot before: `14-desktop-codex-before-send.png`
   - Screenshot after: `15-desktop-codex-after-send.png`
   - Classification: `implemented_verified`（仅限 Desktop 本机一次性 Codex 发送）

3. Desktop 默认仍显示硬编码授权记录。
   - UI: `Web 已授权一次性文件清理`、`rm -rf src/legacy/*`
   - Code evidence: `apps/desktop/src/renderer/store/console-store.ts` 初始化 `authorizationRecords`
   - Classification: `stale_or_ghost`
   - Decision: 这类“已授权/最近活动”不能作为真实授权或通知记录展示；应删除静态 seed，改接真实通知/授权 API 或显示空态。

4. Desktop 独立启动时未登录且云端连接断开，不能证明 Web 本地消息经云端 DeviceChannel 回流到 Desktop。
   - Web local_desktop audit 已显示 `/api/chat` 409：`本地 Desktop 未连接云端`
   - Classification: `partial_shell`
   - Decision: Desktop 本地 CLI 能跑，不等于 Web local_desktop 主链路打通。仍需修复/验收设备绑定、channel endpoint、Web -> DeviceChannel -> Desktop runtime。

## 待继续审计

## Mobile

### 发现

1. `/m` 在 opencli 真实浏览器状态下永久停留 `加载中 / 正在获取数据，请稍候`。
   - Screenshot: `16-mobile-entry.png`
   - Manual page-context fetch: `/api/workspaces` returns `200` and JSON, so不是 API 本身完全不可用。
   - Playwright reproduction: `17-mobile-playwright-entry.png`
   - Browser evidence: `_next/static/...` CSS/JS chunks return `400 Bad Request`，React 没有 hydrate，`useEffect` 不执行。
   - Classification: `missing_required`
   - Decision: Mobile 工作区入口当前不可验收；工作区选择、会话选择和发送链路均被阻断。

2. `/m/approve` 同样永久停留加载态。
   - Screenshot: `18-mobile-approve-loading.png`
   - Classification: `missing_required`
   - Decision: Mobile 远程授权入口当前不可用，无法证明通知读取、授权/取消、状态读回。

3. `/m/preview?url=...&title=...` 同样停留 Suspense/loading fallback。
   - Screenshot: `19-mobile-preview.png`
   - Classification: `partial_shell`
   - Decision: 预览页面当前不能证明真实预览内容展示；代码本身也只是静态 `文件内容将在此显示` 占位，不读取 URL 内容。

4. Mobile 代码缺少新建工作区和新建会话能力。
   - Code evidence: `apps/web/app/m/page.tsx` 只读取 `/api/workspaces` 和 `/api/sessions?workspace_id=...`，没有创建工作区/会话入口。
   - Classification: `partial_shell`
   - Decision: 如果 PRD 要求三端均可完成核心对话，Mobile 不能只依赖 Web 先创建工作区和会话。

5. Mobile 会话页不支持附件上传或 artifact 面板。
   - Code evidence: `apps/web/app/m/sessions/[sessionId]/page.tsx` 只支持默认 role 发送文本到 `/api/chat`。
   - Classification: `missing_required`
   - Decision: 三端全部功能覆盖时，Mobile 需要至少明确禁用并给中文原因；如果 P0 要求可用，则要补上传、附件引用和 artifact/preview 闭环。

## 待继续审计

- GitHub 登录：若需要重新 OAuth，交给用户在浏览器中完成；本轮不读取或代填敏感凭证。

## 集中修复清单

### P0 阻断

1. Web 工作区创建/进入后不能直接发送。
   - 云端和本地都需要自动进入可发送状态：创建工作区后进入工作区，并自动创建/选择首个会话，或主区域提供明确 CTA。

2. Web 本地工作区 UI 状态和 `/api/chat` 判定冲突。
   - 页面显示 `Desktop：已连接 / 本地 Runtime：可操作 / 可操作模式`，但发送返回 `本地 Desktop 未连接云端`。
   - 必须统一 `/api/runtime/status`、工作区列表、`/api/chat` 的可操作来源，修复 device channel endpoint 判定。

3. 云端 runtime 未真正可用。
   - 当前只能返回 `endpoint_unavailable`，不能证明 cloud worker 真实回复和 artifact 产出。
   - 验收前必须启动/接入真实 worker，或者在 UI 入口上明确云端不可操作，不能显示成可操作主流程。

4. Mobile 无法 hydrate。
   - 当前 `_next/static` 资源 400 导致 `/m`、`/m/approve`、`/m/preview` 永久 loading。
   - 必须修复构建/启动或资源服务问题，并补真实移动端流程测试。

5. Mobile 核心功能不完整。
   - 缺新建会话/工作区能力，缺附件，缺 artifact，审批和预览未完成真实闭环。

6. Artifact 没有真实产出闭环。
   - Web 面板当前只能证明空态，不能证明产出、持久化、刷新读回或后续部署消费。

### P0 同类残留

1. Desktop 静态授权记录残留。
   - 删除 `Web 已授权一次性文件清理` 等 seed 数据，改真实 API 或空态。

2. 附件 UI/上下文可见性不闭环。
   - API 可保存内容，但刷新后聊天区和 Artifact 上下文看不到附件；UI 上传还需要真实文件选择器验收。

3. `@角色` 仅完成选择和用户消息持久化。
   - 缺真实角色回复、角色上下文进入 runtime 的端到端证据、刷新后角色回复 badge。

4. 预览页是占位。
   - `/m/preview` 代码只展示 `文件内容将在此显示`，不是 artifact/contentRef 真实预览。

### 验收测试必须补齐

1. Web UI：创建云端工作区 -> 自动会话 -> 发送 -> runtime 回复/artifact -> 刷新读回。
2. Web UI：创建/进入本地工作区 -> Web 发送 -> DeviceChannel -> Desktop Codex/Claude -> 回复落库 -> 刷新读回。
3. Web UI：`@架构师` + 附件 token -> 回复或 artifact 中可读到 token。
4. Desktop：登录/设备绑定 -> channel connected -> runtime detection -> 收 Web invoke -> 真实 CLI 输出回流。
5. Mobile：工作区/会话 -> 发送 -> 错误态或真实回复；审批授权；artifact preview。
6. 负向：worker 未启动、Desktop 未连接、CLI 未登录、附件缺失、角色越权都要中文错误且不落伪成功。

## 复测进展（2026-06-01 19:00 后）

### 已修复并验收

1. Web 创建云端工作区后自动进入并自动具备会话。
   - Workspace: `AUDIT-REAL-CLOUD-1780313300`
   - ID: `4b2fdb12-8100-4d71-8119-0ea34076bfea`
   - Screenshot: `26-web-create-auto-enter.png`
   - Classification: `implemented_verified`

2. 真实 GitHub 登录用户的 public cloud endpoint 不再只依赖 fixture 用户。
   - Root cause: `runtime_endpoints` 只有 fixture 用户的 `public_cloud`，真实 GitHub 用户 `042e916a-964f-4d2b-bdc5-d59d68a32e70` 解析为 `unconfigured`。
   - Fix: `resolveEndpoint()` 对真实用户缺省 provision `public_cloud` endpoint。
   - Endpoint: `034af498-53e9-4fe6-829d-636718a2b400`
   - Classification: `implemented_verified`

3. 云端真实 worker 链路打通。
   - Worker: local real `codex` CLI worker, `RUNTIME_EXECUTOR=real`, `RUNTIME_CLI=codex`
   - Test prompt: `云端真实worker发送 AUDIT 1780315000。请只回复 CLOUD_OK_1780315000`
   - UI result: `CLOUD_OK_1780315000`
   - Runtime session: `4023f05e-84eb-4ae6-a7c9-74bf37c1fd26`, status `completed`
   - Runtime logs: `gateway_connected` -> `public_runtime_available=true` -> `runtime_status=running` -> `runtime_output=CLOUD_OK_1780315000` -> `runtime_completed`
   - Screenshot: `31-cloud-real-worker-success.png`
   - Classification: `implemented_verified`

4. Codex CLI adapter 使用当前 CLI 正确非交互命令。
   - Root cause: 旧实现执行 `codex -p <prompt>`；当前 Codex CLI 的 `-p` 是 `--profile`，导致 `runtime CLI exited with code 2`。
   - Root cause 2: spawn 默认保留 stdin pipe，`codex exec` 等待 stdin EOF，导致运行中超时。
   - Fix: Codex 分支改为 `codex exec -s read-only --color never <prompt>`，且 `stdio: ['ignore', 'pipe', 'pipe']`。
   - Classification: `implemented_verified`

5. `@架构师` 真实 runtime 链路打通。
   - Role ID: `184894ee-729a-4b22-8029-fb018650aa76`
   - Test prompt: `角色真实worker发送 AUDIT 1780315200。请只回复 ROLE_OK_1780315200`
   - UI result: agent message shows `架构师` badge and `ROLE_OK_1780315200`
   - DB: user/agent messages and `runtime_sessions.role_agent_id` all persisted role id.
   - Runtime session: `73292a36-ff81-4925-b0ba-6027c921592a`, status `completed`
   - Screenshot: `32-role-real-worker-success.png`
   - Classification: `implemented_verified`

6. 附件内容进入真实 runtime prompt。
   - Attachment ID: `1300c407-deaf-415a-b422-3ab06125e72a`
   - Token: `ATTACHMENT_UI_TOKEN_1780315400`
   - Test prompt: `附件真实worker发送 AUDIT 1780315500`
   - Runtime output: `ATTACHMENT_UI_TOKEN_1780315400`
   - UI refresh: chat shows attachment system message, user prompt, and token reply; context panel shows pinned attachment.
   - Screenshot: `33-attachment-real-worker-success.png`
   - Classification: `implemented_verified` for API/context/runtime; UI file chooser still blocked by opencli bug below.

7. Artifact 真实产出、持久化、面板读回已打通。
   - Test prompt: `产物真实worker发送 AUDIT 1780315700`
   - Runtime output: `<agenthub-artifact title="审计产物 1780315700" type="markdown">ARTIFACT_TOKEN_1780315700</agenthub-artifact>`
   - DB: inserted pinned artifact message with `metadata.artifact`.
   - UI result: `产物` tab shows `审计产物 1780315700` and `ARTIFACT_TOKEN_1780315700`.
   - Screenshot: `34-artifact-real-worker-success.png`
   - Classification: `implemented_verified`

8. Mobile 会话页真实 worker 发送打通。
   - Route: `/m/sessions/35a7dbf8-8457-4277-aa15-8a88a7ae046f`
   - Test prompt: `移动端真实worker发送 AUDIT 1780315900。请只回复 MOBILE_OK_1780315900`
   - UI result: role badge `架构师` and `MOBILE_OK_1780315900`
   - Runtime session: `b932c167-4117-47e1-bc27-dcb160ccd08d`, status `completed`
   - Screenshot: `35-mobile-real-worker-success.png`
   - Classification: `implemented_verified`

9. 本地 Desktop 离线时 Web 不再误报可操作。
   - `/api/runtime/status`: `operable=false`, `blockReason=desktop_offline`
   - UI after hard reload: `Desktop：未连接`、`本地 Runtime：只读`、`只读模式`、composer gate 中文阻断。
   - Screenshot: `29-local-after-hard-reload-readonly.png`
   - Classification: `implemented_verified` for offline negative path.

10. Desktop 静态授权记录残留已删除。
   - Code/build evidence: `apps/desktop/src/renderer/store/console-store.ts` now initializes `authorizationRecords: []`.
   - `pnpm --filter @agenthub/desktop build` passed.
   - `rg "Web 已授权一次性文件清理|rm -rf src/legacy"` returns no source/dist hit.
   - Classification: `implemented_verified`

### 仍需补测或外部条件

1. Web -> DeviceChannel -> Desktop 本地 runtime 正向链路还未在当前 Web server 进程验收。
   - 当前真实状态是 Desktop 未连接云端，本地工作区应只读，负向已验证。
   - 正向需要 Desktop 使用当前 Web server 重新登录/绑定/连接后再发 Web local message。

2. opencli UI 文件上传命令仍阻断。
   - Command: `opencli browser agenthub upload '[data-testid="attachment-file-input"]' ...`
   - Error: `SyntaxError: Identifier 'markerAttr' has already been declared`
   - 本轮用同一浏览器登录态的页面上下文调用真实 `/api/attachments` 补齐附件 API/context/runtime 验收；仍需 opencli 修复或人工/Playwright file chooser 补一条纯 UI 文件选择器验收。

3. Mobile 附件上传和产物编辑仍按 UI 明确禁用。
   - Mobile 会话页显示：`移动端附件上传和产物编辑暂未开放，请在 Web 工作台处理附件与产物。`
   - 如果验收口径要求 Mobile 也完整上传/编辑 artifact，需要继续补功能；如果 Mobile P0 是控制/审批/预览，则当前是明确降级而非假完成。
