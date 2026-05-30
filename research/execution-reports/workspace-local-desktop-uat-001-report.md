# WORKSPACE-LOCAL-DESKTOP-UAT-001 执行报告

## 1. 范围

本任务按 Trellis / Codex inline 执行，未使用 Maestro/Ralph。目标是修复用户在 Web 3000 workspace 与 Desktop dev 中真实遇到的可用性缺口：

- Workspace 内缺返回“我的工作区”、登录状态、Desktop 连接状态、本地 Runtime 状态。
- 未连接 Desktop 时仍可创建 `local_desktop` 工作区。
- 当前右栏 Agents 只能看默认架构师，无法在真实入口中增删改查。
- 编排 Tab 把 API 错误泛化为“加载编排数据失败”。
- 附件按钮可点但无效果。
- Desktop renderer 调 `device-channel:connect` 时可能得到 Electron 低层错误 `No handler registered`。

共享合同：`research/contracts/WORKSPACE-LOCAL-DESKTOP-UAT-001.md`。

## 2. 实现摘要

### Web workspace

- 新增 `/api/runtime/status`：返回当前 Auth.js 用户摘要、Desktop 设备连接状态、本地 Runtime 可用状态。
- `/api/workspaces` POST 增加服务端门禁：`execution_domain='local_desktop'` 时必须存在当前用户的 connected `device_runtime_channels`，否则返回 409 和中文引导。
- `WorkspaceShell` 增加状态栏：返回“我的工作区”、登录用户、Desktop 已连接/未连接、本地 Runtime 可用/不可用、刷新状态。
- `CreateWorkspaceDialog` 接入 runtime status：未连接 Desktop 时显示门禁说明并禁用本地工作区创建提交。
- `ArtifactPanel` 的 Agents Tab 升级为真实 Role Agent CRUD：列表、创建、编辑、删除、设为编排者，全部走 `/api/role-agents` 与 `/api/role-agents/:id`。
- `ChatPanel` 监听 `role-agents:changed` 事件，Agents CRUD 后 @角色列表自动刷新。
- `OrchestratorPanel` 区分 `/api/plans` 与 `/api/actions` 失败，显示状态码和后端 message，不再只有泛化错误。
- 附件按钮改为明确禁用，按钮 label/title 与可见说明均写明“附件上传暂未开放”。

### Desktop

- 新增 `device-channel-ipc.ts` 作为 IPC 注册单点。
- `DeviceChannel` 注册 active handlers 前会移除旧 handler，避免热重载/重复注册异常。
- `setupRuntime()` 在 DeviceChannel 初始化失败时注册 fallback handlers：`connect` 返回“设备通道不可用：原因”，`state` 返回 `disconnected`，防止 renderer 收到 Electron 的 `No handler registered`。
- UI/报告说明 Electron 链路：renderer → preload IPC → main DeviceChannel WebSocket → Cloud Runtime Gateway → RuntimeHost → StreamAdapter → 本机 `claude`/`codex` CLI。AgentHub Desktop 不托管本地 CLI API Key。

## 3. 验证

- `pnpm --filter @agenthub/web type-check` → PASS。
- `pnpm --filter @agenthub/desktop type-check` → PASS。
- `pnpm --filter @agenthub/desktop test -- device-channel-ipc.test.ts` → 2 passed。
- 真实浏览器 UAT：
  - 命令：`set -a; source docker/.p0-test.env; set +a; npx playwright test e2e/tests/web/workspace-local-desktop-uat.spec.ts --config e2e/playwright.config.ts --project=web-desktop --workers=1`
  - 结果：1 passed (6.5s)。
  - 覆盖：真实 Postgres + Auth.js session；`POST /api/workspaces` cloud 201；`local_desktop` 未连接时 409；`/workspace/:id` 状态栏/返回入口；附件禁用说明；Agents create/edit/delete；@角色列表同步；无横向滚动。

第一次 Playwright 运行因未加载 `docker/.p0-test.env` 缺认证 cookie 失败；第二次加载 env 后在沙箱内 Chromium 被 macOS MachPort 权限拒绝；提升权限后同一条 UAT 通过。

## 4. 残留与边界

- 附件上传后端仍未实现，本任务选择“诚实禁用 + 明确说明”，不交付半成品上传。
- 真实 Desktop GUI 自动化仍依赖本地 Electron 启动环境；本任务用 Desktop main IPC 单测覆盖 no-handler 根因，并通过 type-check 约束 main/preload 类型。
- `DEV-ENV-BOOTSTRAP-001 / REG-20260530-008` 仍 open：默认 `.env.local` 开发环境引导问题未在本任务内处理。
- 任务前已有 5 个 E2E dirty 文件未纳入本任务提交。
