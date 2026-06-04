# Runtime Permission Broker 修复报告（2026-06-05）

## Scope

Trellis task: `.trellis/tasks/06-05-fix-runtime-permission-broker`

本任务修复 runtime/native CLI/tool 请求进入产品 permission broker 的路径，并补 Web 消息流结构化权限卡元数据。最终固定样本三端 OpenCLI UAT 不在本任务内执行，保留给 `06-05-opencli-role-runtime-uat`。

## Changes

- `CliOutputParser` 解析常见 Claude stream-json `tool_use` 与 Codex JSON `exec_command` / tool call 形态，输出结构化 `toolRequest`。
- `runtime-worker` 在检测到 native tool request 后：
  - 使用 shared `evaluateNativeCliToolPermission` 做 workspace/root 校验。
  - 创建 pending `actions` 行与 `approval_required` notification。
  - 发布 `approval_requested` 事件，包含 action kind、命令、路径、cwd、workspace root、risk。
  - 停止当前 runtime job，错误为 `Runtime 工具已进入权限审批，未执行该操作。`，不把该工具当普通输出流继续执行。
- `dispatchApprovedAction` 在已授权动作真正投递前重新校验 selected workspace root：outside-root `cwd` 或命令中的 outside-root absolute path 都会记录 dispatch failure，且不会 `createSession` / `enqueue`。
- `RuntimeGatewayEvent` 与 `RuntimeMessagePart` 扩展 permission 元数据；`/api/chat` 持久化这些字段；Web message permission card 显示动作、命令、cwd、workspace root、路径，拒绝后显示 `已拒绝，未执行该操作。`。
- `.trellis/spec/backend/runtime-workspace-contract.md` 已补 fail-closed broker/job/event/dispatch 边界规则。

## Verification

- Work commit: `d9c4b27 fix: 修复 runtime permission broker`
- Status commit: `7a5b0a2 docs: 记录 runtime permission broker 提交`
- Archive commit: `77f4e0f chore(task): archive 06-05-fix-runtime-permission-broker`
- `pnpm --filter @agenthub/shared test -- src/domain/runtime-workspace.test.ts` PASS（1 file / 15 tests）
- `pnpm --filter @agenthub/web test -- __tests__/runtime/executor.test.ts __tests__/orchestrator/action-dispatcher.test.ts __tests__/message-markdown.test.ts __tests__/api/chat.test.ts __tests__/runtime/gateway-gating.test.ts __tests__/runtime/local-device-relay.test.ts` PASS（6 files / 66 tests）
- `pnpm --filter @agenthub/web type-check` PASS
- `pnpm --filter @agenthub/shared type-check` PASS
- `pnpm --filter @agenthub/web lint` PASS（仅既有 Next lint deprecation/config warning，无 ESLint errors）
- `git diff --check` PASS

## OpenCLI Status

- Web OpenCLI UAT: `not-run by scope`
- Mobile browser/PWA OpenCLI UAT: `not-run by scope`
- Desktop/Electron OpenCLI UAT: `not-run by scope`

原因：本任务只修 broker 与自动化回归；最终固定样本三端真实 UI UAT 属于下一项 `06-05-opencli-role-runtime-uat`。

## Residual Risk

- 当前实现不会恢复 native CLI 内部的同一 tool prompt；它在产品边界创建 pending action 并停止当前 runtime job。用户允许后通过现有 action dispatcher 重新投递，且重新执行 workspace-root 校验。
- CLI JSON event 形态按已知 Claude/Codex 常见结构覆盖；若未来 CLI 输出结构变更，需要在 `apps/web/lib/runtime/executor.ts` 增加对应 parser fixture。
