# Local Desktop operability and runtime truth

## Goal

按 `research/contracts/LOCAL-DESKTOP-OPERABILITY-001.md` 实现本地 Desktop 工作区的只读/可操作模式、真实 Runtime doctor、Web 状态门禁，并修复 `/api/plans` 在本地 Postgres adapter 下的 500。

## Confirmed Product Decisions

* Web 服务器不能直接连接用户本机 Claude Code / Codex；本地执行必须通过 AgentHub Desktop。
* Local Desktop Workspace 支持两种进入：只读进入、可操作进入。
* Desktop 离线或 Runtime doctor 失败时允许只读查看历史，但禁止继续执行。
* 可操作进入必须满足：同一账号已登录、Desktop 云端连接在线、CLI doctor 通过、native session 可恢复或可新建。
* 输入区在只读模式下禁用，并展示阻塞原因和刷新连接状态入口。
* 用户可见文案不再以“设备通道”为主，改为账号、云端连接、本地 Runtime、Session 恢复。
* Codex / Claude Code 不得 hardcode 为 connected；必须从真实 doctor 状态派生。

## Functional Scope

1. 修复 `/api/plans`：
   * 将 `select('*, plan_nodes(*)')` 改为两段查询并组装 `plan_nodes`。
   * 原因：当前本地 Postgres adapter 不支持 Supabase nested select。
2. 工作区可操作性状态：
   * `/api/runtime/status` 返回 `readOnlyAvailable`、`operable`、`blockReason`、Desktop 状态、Runtime 状态。
   * 原因：UI 必须区分历史可查看与本地可执行。
3. Web 工作区入口和只读模式：
   * “我的工作区”列表展示执行域、只读/可操作、阻塞原因。
   * Local Desktop Workspace 提供“查看历史”和“连接并继续”。
   * 工作区内部只读时禁用发送并展示原因。
4. Desktop Runtime doctor：
   * 检测 Claude Code / Codex 是否安装、版本、认证/可启动状态。
   * Runtime 卡片从 doctor 状态派生是否可进入。
5. Desktop 文案与按钮治理：
   * “设备通道”用户文案替换为“云端连接”。
   * 诊断/重新检测保持可用。
   * 继续/重试/停止仅在有真实运行态时显示或启用。
6. native session 恢复口径：
   * 本轮建立 `native_session_unavailable` 阻塞原因，不伪造 resume 成功。

## Out of Scope

* 不实现 Claude Code / Codex 完整 resume/continue provider 适配。
* 不实现 OS deep link 自动打开 Desktop。
* 不做 Mobile UI 改造。
* 不引入新托管平台或保存本地 CLI API Key。

## Acceptance Criteria

* [x] `/api/plans` 不再因 `column "*"` 报 500。
* [x] Local Desktop Workspace 离线时 Web 可只读进入，但输入和发送禁用。
* [x] “我的工作区”列表能区分云端、本地、只读、可操作和阻塞原因。
* [x] Desktop Runtime 卡片不再 hardcode Codex / Claude Code 为已接入。
* [x] Desktop 用户文案使用“云端连接”而不是“设备通道”作为主标签。
* [x] `pnpm --filter @agenthub/web type-check` 通过。
* [x] `pnpm --filter @agenthub/desktop type-check` 通过。

## Technical Notes

* 共享合同：`research/contracts/LOCAL-DESKTOP-OPERABILITY-001.md`。
* 相关代码：`apps/web/app/api/plans/route.ts`、`apps/web/app/api/runtime/status/route.ts`、`apps/web/components/workspace/*`、`apps/desktop/src/main/runtime/runtime-detector.ts`、`apps/desktop/src/renderer/store/console-store.ts`、`apps/desktop/src/renderer/components/shell/*`。
* 相关文档：`research/prd.md`、`research/product/product-design.md`、`research/modules/desktop-connector.md`、`research/modules/runtime-adapters.md`。
