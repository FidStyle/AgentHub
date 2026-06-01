# 验收收尾旧入口与运行态口径修复报告（2026-06-02）

## 范围

- 停用旧 `/api/runtime/invoke`，避免“发送到 DeviceChannel 就返回 invoked”的假成功口径。
- 删除未挂载旧 Web 工作台组件和旧 store，避免后续误接旧语义。
- `/api/runtime/status` 和 Web 工作区 UI 明确标注 native session 暂不可恢复，当前只支持一次性 CLI 执行。

## 变更

- `apps/web/app/api/runtime/invoke/route.ts`：认证后返回 410，提示从工作台 `/api/chat` 经 Runtime Gateway 和 Desktop DeviceChannel 执行。
- `apps/web/app/api/runtime/status/route.ts`：新增 `runtime.nativeSessionAvailable=false`、`runtime.nativeSessionDescription`；ready 描述追加一次性 CLI 限制。
- `apps/web/components/workspace/useWorkspaceRuntimeStatus.ts`、`WorkspaceShell.tsx`、`workspace/page.tsx`：类型和 UI 文案同步“原生会话暂不可恢复 / 一次性可执行”。
- 删除旧文件：`components/chat/ChatPanel.tsx`、`components/layout/DetailPanel.tsx`、`components/layout/Sidebar.tsx`、`stores/chat-store.ts`、`lib/device-gateway-client.ts`。
- 新增测试：`apps/web/__tests__/api/runtime-invoke.test.ts`、`apps/web/__tests__/api/runtime-status.test.ts`。

## 验证

- `pnpm --filter @agenthub/web test -- runtime-invoke.test.ts runtime-status.test.ts`：PASS，2 files / 3 tests。
- `pnpm --filter @agenthub/web type-check`：PASS。
- 残留引用扫描：旧 Web 组件/store、旧 `device-gateway-client`、`sendRuntimeInvoke` 无残留引用。

## 未覆盖

- 未实现 Claude Code / Codex native session resume/continue。本轮只修正产品口径，避免把一次性 CLI 执行误写成可续接原生会话。
- 未跑真实浏览器 UAT；多角色、pin、通知、附件/artifact 和文件预览主入口仍需单独复验。
