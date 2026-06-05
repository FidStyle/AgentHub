# 单 prompt 权限续跑回归 UAT 报告

日期：2026-06-05  
TASK-ID：SINGLE-PROMPT-PERMISSION-CONTINUATION-2026-06-05  
任务：`.trellis/tasks/06-05-fix-single-prompt-permission-continuation`  
回归：`REG-20260605-003`  
事实源：`bytedance_init_prd.md`、`bytedance_init_video_txt.txt`

## 结论

本轮修复“点击允许单次执行后没有继续往下运行”的权限续跑回归。修复后的语义是：

- 自动权限模式：低/中风险并被策略允许的 runtime native tool request 自动 approve、dispatch continuation，不停在人工审批。
- 手动允许：点击“允许单次执行”后，action 进入 running/completed/failed 状态并续跑原始 runtime/plan 链路，原消息内 permission card 同步为 running/completed/failed。
- 手动拒绝：点击“拒绝”后不执行副作用，action 变 `rejected`，plan node 保持 `waiting`，写入 durable system event，等待用户下一次输入。

这份报告不重新声明完整 Bytedance fixed-sample product gate 已重跑。旧完整样本通过证据仍见 `research/execution-reports/bytedance-fixed-sample-product-gate-2026-06-05.md`；本报告只关闭后续暴露的权限续跑回归。

## 实现摘要

- `/api/chat`、HostedRuntimeAdapter、runtime gateway 和 Redis `RuntimeJob` 透传 `permissionMode` 与 `workspaceId`。
- runtime worker 在 native tool permission boundary：
  - 手动模式创建 pending action、notification 和 durable message `runtimeParts.permission`。
  - 自动模式创建 approved action 后立即调用 `dispatchApprovedAction` 投递 continuation，并把原 attempt/mailbox 留在 waiting boundary。
- `/api/actions/:id/approve`：
  - approve 时更新 action decision、dispatch continuation，并同步原始 `messages.metadata.runtimeParts.permission.status`。
  - reject 时更新 action 为 `rejected`，不 dispatch，写入 durable system event，plan node 保持 `waiting`。
- worker running/terminal update 会同步原始 inline permission part 为 `running/completed/failed`，并为 action continuation terminal 写 durable result/system event。
- Web `MessageContent` 在 approve/reject 后立即刷新并按 2s 到 5min 递增轮询，历史 permission part 支持 `approved/rejected/running/completed/failed`。

## UAT 证据

| 项 | 值 |
| --- | --- |
| Workspace | `487c6e64-73ca-422f-acc0-0397fa958e14` |
| Workspace root | `/Users/joytion/.agenthub/cloud-workspaces/joytion/permission-fix-webuser_perm_fix_1780654469787-487c6e64` |
| Approve session | `e104da72-2989-4a81-a68d-9cc8661c3aed` |
| Approve action | `60f886f1-2684-49c8-9085-4ad465c4568b` |
| Reject session | `d49c3272-8240-4908-ae8d-5e0ddea2caf8` |
| Reject action | `3312a56a-082c-4e45-b9fc-fe1ae1adb04c` |

### Web Approve

- OpenCLI 点击 `允许单次执行`。
- UI 从 `待确认` 变为 `执行中`。
- 原始 approval message 的 `runtimeParts[0].status` 变为 `running`。
- action 和 plan node 进入 `running`。
- 副作用实际发生：workspace 中写入 `agenthub-permission-status-sync.txt`，内容为 `APPROVE WEBUSER_PERM_FIX_1780654469787`。

### Web Reject

- OpenCLI 点击 `拒绝`。
- 原权限卡显示 `已拒绝，未执行该操作。`。
- DB action 状态为 `rejected`，无 `executed_at`。
- 原始 approval message 的 `runtimeParts[0].status` 变为 `rejected`。
- 插入 durable system event：`已拒绝本次执行...等待你的下一次输入。`
- plan node 保持 `waiting`。
- 截图：`e2e/artifacts/opencli-uat/permission-continuation-web-reject-2026-06-05.png`。

### Mobile/PWA Readback

- `/m/sessions/e104da72-2989-4a81-a68d-9cc8661c3aed` 可读回 plan running 和授权记录。
- `/m/sessions/d49c3272-8240-4908-ae8d-5e0ddea2caf8` 可读回 reject 状态。
- 截图：`e2e/artifacts/opencli-uat/permission-continuation-mobile-reject-2026-06-05.png`。

## 质量门禁

已通过：

```bash
pnpm --filter @agenthub/web type-check
pnpm --filter @agenthub/shared type-check
pnpm --filter @agenthub/web test -- __tests__/api/plans-actions-owner.test.ts __tests__/orchestrator/action-dispatcher.test.ts __tests__/runtime/executor.test.ts __tests__/api/chat.test.ts __tests__/message-markdown.test.ts --run
pnpm --filter @agenthub/web lint
pnpm env:acceptance:smoke
pnpm --filter @agenthub/desktop build
pnpm --filter @agenthub/desktop test
pnpm exec playwright test -c e2e/playwright.desktop.config.ts e2e/tests/desktop/electron.spec.ts e2e/tests/desktop/desktop-main-shell.spec.ts
```

结果：

- Web type-check PASS。
- Shared type-check PASS。
- Web focused regression suite PASS：5 files / 103 tests。
- Web lint PASS（仅既有 Next lint deprecation/config warning，无 ESLint errors）。
- Acceptance smoke PASS：CRUD 5/5，`/api/chat` 12/12。
- Desktop build PASS。
- Desktop Vitest PASS：6 files / 29 tests。
- Electron fallback PASS：21 / 21。

## 残留风险

- OpenCLI 当前没有 AgentHub Electron app adapter；Desktop 仍按项目合同使用 Playwright Electron fallback。
- 本任务验证权限续跑回归，不替代完整固定样本 product gate 重跑。
