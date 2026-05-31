# Workspace local desktop UAT fixes

## Goal

修复 Web workspace 与 Desktop 本地连接的真实可用性缺口。用户在 Web 3000 和 Desktop dev 中应能看到登录/本地连接/runtime 状态，能在 workspace 内管理 Role Agents，能被正确阻止创建不可用的本地工作区，能从工作区返回“我的工作区”，能看到附件能力的明确状态；Desktop 的 `device-channel:connect` IPC 必须真实注册并可调用，且产品需要清楚说明 Electron 如何通过 Cloud Gateway 和本机 CLI 连接 Claude Code / Codex。

共享合同：`research/contracts/WORKSPACE-LOCAL-DESKTOP-UAT-001.md`

## What I already know

- 用户明确要求本任务使用 Trellis 模式实现，不使用 Maestro/Ralph。
- 当前工作区已有任务前 dirty baseline：
  - `e2e/playwright.config.ts`
  - `e2e/tests/artifact.spec.ts`
  - `e2e/tests/messaging.spec.ts`
  - `e2e/tests/web/p0-main-flow.spec.ts`
  - `e2e/tests/workspace.spec.ts`
- Web 问题：
  - 编排面板会显示“加载编排数据失败”。
  - Agents 面板只有架构师，当前 workspace 路径内无法增删改查。
  - 工作区内部没有返回“我的工作区”的入口。
  - 工作区内部没有清晰显示登录状态、本地 Desktop 连接状态、本地 Runtime 状态。
  - 未连接本地时仍可选择/创建本地桌面工作区。
  - 附件按钮可见但无行为。
- Desktop 问题：
  - `Uncaught (in promise) Error: Error invoking remote method 'device-channel:connect': Error: No handler registered for 'device-channel:connect'`。
- 已查代码事实：
  - `apps/web/components/orchestrator/OrchestratorPanel.tsx` 并发请求 `/api/plans` 和 `/api/actions`，任一失败时显示泛化错误“加载编排数据失败”。
  - `apps/web/components/workspace/ArtifactPanel.tsx` 当前可读真实 role agents、messages 派生的产物/上下文，并保留编排 Tab，但 Agents Tab 只是列表展示，不提供 CRUD。
  - `apps/web/components/workspace/CreateWorkspaceDialog.tsx` 当前允许选择 `local_desktop`，没有本地连接门禁。
  - `apps/web/components/workspace/ChatPanel.tsx` 附件按钮只是 `IconButton`，没有 `onClick` 或禁用说明。
  - `apps/desktop/src/preload/index.ts` 暴露 `deviceChannel.connect`，调用 `ipcRenderer.invoke('device-channel:connect', config)`。
  - `apps/desktop/src/main/device-channel.ts` 的 `DeviceChannel` 构造函数会注册 `device-channel:connect` handler。
  - `apps/desktop/src/main/index.ts` `setupRuntime()` 中实例化 `DeviceChannel` 并传给 `RuntimeHost`，但用户真实 dev 环境仍遇到 no handler，说明需要补初始化/构建一致性/测试覆盖。
  - Electron 到 Claude/Codex 的链路是：renderer → preload IPC → main `DeviceChannel` WebSocket → Gateway request → `RuntimeHost` → `StreamAdapter` → `spawn('claude'|'codex')` → stdout/stderr runtime events 回传。

## Assumptions

- 本任务优先保证用户可见结果和错误态，不把未实现能力伪装成完成。
- 附件上传如果没有现成后端合同，本任务可选择“诚实禁用 + 明确后续任务”，而不是半成品上传。
- Desktop GUI E2E 可能受本地 Electron 构建/显示环境限制；如不能跑完整 GUI，应至少补 main/preload/renderer 测试与手动验证指引。
- 任务前已有 5 个 E2E dirty 文件默认不属于本任务，提交时必须隔离。

## Requirements

### Web Workspace

- [ ] Workspace 内提供返回“我的工作区”的入口。
- [ ] Workspace 内显示当前登录状态或用户身份摘要。
- [ ] Workspace 内显示 Desktop 本地连接状态和本地 Runtime 状态。
- [ ] 创建 `local_desktop` 工作区前必须检查 Desktop 连接状态；未连接时禁用或明确提示，不允许静默创建不可用本地工作区。
- [ ] Agents 面板支持当前 workspace 的真实 Role Agent CRUD：列表、创建、编辑、删除、设为/取消编排者。
- [ ] Agents CRUD 必须走真实 `/api/role-agents` API 并刷新列表。
- [ ] 编排面板必须区分未选会话、空数据、plans/actions API 错误，并显示具体中文错误。
- [ ] 附件按钮必须有真实行为或明确禁用说明；不得可点无效果。
- [ ] 新增 UI 不得造成横向滚动、遮挡、按钮不可点击。

### Desktop / Local Runtime

- [ ] 修复或防止 `device-channel:connect` no handler：main/preload/renderer 链路必须可测。
- [ ] Desktop 状态应能解释本机 Claude Code / Codex CLI 的检测、认证与连接方式。
- [ ] 文案明确：AgentHub Desktop 不托管 API Key，依赖本机已安装并认证的 Claude Code / Codex CLI。
- [ ] 如果 Desktop 未连接，Web 创建本地工作区必须给出可行动引导。

## Acceptance Criteria

- [ ] Web E2E：打开 `/workspace/:id`，看到返回入口、用户状态、本地连接/runtime 状态。
- [ ] Web E2E：未连接 Desktop 时选择本地工作区创建被阻止或明确提示；cloud 创建不回归。
- [ ] Web E2E/API：Agents Tab 能创建、编辑、删除 Role Agent，并在 @角色选择中同步。
- [ ] Web E2E：编排 Tab 对空态与 API 错误显示不同文案，错误包含状态码或后端 message。
- [ ] Web E2E：附件按钮不可用时禁用并显示明确说明，不能可点击无效果。
- [ ] Desktop 测试：`device-channel:connect` handler 已注册，preload 调用不报 no handler。
- [ ] Runtime 链路说明出现在 UI 或任务文档中，并与代码实现一致。
- [ ] `pnpm --filter @agenthub/web type-check` 通过；Desktop 改动时 `pnpm --filter @agenthub/desktop type-check` 通过。
- [ ] 不提交任务前已有的 5 个 E2E dirty 文件，除非用户明确确认它们属于本任务。

## Definition of Done

- Tests added/updated with real user-result assertions, not only `toBeVisible`.
- Type-checks pass for touched packages.
- `research/project-tracker.md` and `research/regression-ledger.md` reflect this task.
- Shared contract remains aligned with implementation.
- Commit uses precise `git add` and Chinese message; no `git add .`.
- `refer_proj/*` is not committed.

## Implementation Notes

- Added `/api/runtime/status` as the Web status contract for Auth.js user summary, Desktop connection state, and local runtime availability.
- Added server-side `local_desktop` workspace creation gate in `/api/workspaces`; frontend dialog mirrors the same state but does not replace backend enforcement.
- Moved Role Agent CRUD into the current right-panel Agents tab and dispatch `role-agents:changed` so the chat @ picker refreshes after CRUD.
- Desktop `device-channel:connect` now has active/fallback IPC registration through `device-channel-ipc.ts`; initialization failures return an explicit device-channel error instead of Electron's `No handler registered`.
- Desktop local activity now supports expandable details for long Runtime output, while keeping the activity list compact and scroll-bounded.
- Desktop Runtime detection no longer renders long CLI paths inline in the narrow right panel; paths move behind a “查看 CLI 路径” dialog with copy support.
- Desktop local workspace can switch Agent type directly from the local Agent session header; unavailable runtimes remain visible but disabled.
- Desktop recent sessions now derive from real local Runtime message activities (`[Codex] ...` / `[Claude Code] ...`) instead of showing a permanent empty placeholder.
- Runtime CLI resolution now handles Finder/Dock launches by trying login shell, interactive shell, and common installation paths such as nvm, fnm, asdf, Homebrew, and local bin directories; execution uses the resolved absolute CLI path.
- Runtime CLI execution now prepends the resolved CLI bin directory to PATH so nvm-installed Codex can find its sibling `node` when the app is launched from Finder/Dock.

## Verification Results

- `pnpm --filter @agenthub/web type-check` — PASS.
- `pnpm --filter @agenthub/desktop type-check` — PASS.
- `pnpm --filter @agenthub/desktop test -- device-channel-ipc.test.ts` — 2 passed.
- `npx playwright test e2e/tests/web/workspace-local-desktop-uat.spec.ts --config e2e/playwright.config.ts --project=web-desktop --workers=1` with `docker/.p0-test.env` loaded — 1 passed (6.5s) after granting Chromium launch permission.
- `pnpm --filter @agenthub/desktop test -- --run` — 21 passed.
- `pnpm --filter @agenthub/desktop build` — PASS.

## Out of Scope

- Full file attachment upload backend, unless existing contracts make it small and safe.
- Full Desktop packaged app E2E if `DESKTOP_APP_PATH` or GUI environment is unavailable.
- Reworking Cloud Runtime Gateway architecture.
- Fixing pre-existing dirty E2E files unless they are explicitly pulled into this task.
- Fixing default `.env.local` bootstrap (tracked separately as `DEV-ENV-BOOTSTRAP-001` / REG-20260530-008).

## Technical Notes

- Relevant contract: `research/contracts/WORKSPACE-LOCAL-DESKTOP-UAT-001.md`.
- Relevant specs to read before coding:
  - `.trellis/spec/guides/end-to-end-contract-planning.md`
  - `.trellis/spec/guides/product-planning-guide.md`
  - `.trellis/spec/guides/cross-layer-thinking-guide.md`
  - `.trellis/spec/frontend/index.md`
  - `.trellis/spec/frontend/component-guidelines.md`
  - `.trellis/spec/frontend/ui-style-guidelines.md`
  - `.trellis/spec/frontend/quality-guidelines.md`
  - `.trellis/spec/cross-layer/runtime-gateway-contract.md`
  - `.trellis/spec/cross-layer/runtime-credential-boundary.md`
  - `.trellis/spec/cross-layer/self-hosted-infra-policy.md`
  - `.trellis/spec/backend/error-handling.md`
  - `.trellis/spec/backend/quality-guidelines.md`
- Relevant code found during planning:
  - `apps/web/components/workspace/ArtifactPanel.tsx`
  - `apps/web/components/orchestrator/OrchestratorPanel.tsx`
  - `apps/web/components/workspace/CreateWorkspaceDialog.tsx`
  - `apps/web/components/workspace/ChatPanel.tsx`
  - `apps/desktop/src/preload/index.ts`
  - `apps/desktop/src/main/device-channel.ts`
  - `apps/desktop/src/main/runtime/runtime-host.ts`
  - `apps/desktop/src/main/runtime/stream-adapter.ts`
