# ACCEPTANCE-REAL-FLOW-2026-06-01 执行报告

## 结论

2026-06-01，验收真实闭环已通过当前自动化和定向 UAT。完成范围包括 opencli 验真 skill、真实 runtime worker 默认策略、本地 Desktop `@` 链路、远程 cloud `@` 链路、390x844 Mobile/PWA 视口、附件内容传递、artifact durable output 和最终治理证据。

本报告只记录真实 DB/API/session/runtime 路径，不使用 `FakeExecutor`、`ScriptedRealExecutor`、mock API、`playwright --list` 或截图存在作为主链路成功证据。

## 关键证据

| 项 | 证据 |
| --- | --- |
| opencli | `opencli doctor` PASS：Daemon OK、Extension connected、Connectivity OK；仅有版本更新提示。 |
| 本地 Desktop @ 链路 | commit `08440f7`：Web `/api/chat` -> Gateway -> Redis relay -> Desktop DeviceChannel -> Electron `RuntimeHost` -> 真实 Claude CLI -> SSE -> DB；`runtime_sessions.status=completed`，agent message 落库。 |
| 远程 cloud @ 链路 | commit `dc4bd21`：Web cloud `@架构师` 和 390x844 Mobile/PWA 均经 Gateway/Redis/runtime worker/real executor 返回非 echo 回复并落库。 |
| runtime_logs | public cloud 已去除 Gateway/worker 双写；移动验收样本 `runtime_logs` 为 `gateway_connected:0, runtime_status:0, public_runtime_available:1, runtime_output:1, runtime_completed:2`。 |
| 附件 | commit `dc3e75d`：`/api/attachments` 写入真实 `messages.metadata.attachment.content/contentRef`，`@角色` 请求携带 `attachmentIds` 并把附件内容注入 runtime prompt。 |
| artifact | runtime 输出 `<agenthub-artifact ...>` 后额外落 pinned message，`metadata.artifact` 可刷新读取，Artifact 面板可见。 |
| 截图 | `e2e/artifacts/opencli-uat/web-opencli-home.png`、`web-workspace-after-local-flow.png`、`mobile-cloud-real-flow-390x844.png`、`attachment-artifact-panel.png`。 |

## 验证命令

- `opencli doctor` PASS。
- `pnpm --filter @agenthub/web type-check` PASS。
- `pnpm --filter @agenthub/desktop type-check` PASS。
- `pnpm --filter @agenthub/web test -- __tests__/runtime __tests__/api/chat.test.ts` PASS（7 files / 31 tests）。
- `pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts` PASS（6 tests）。
- `pnpm env:acceptance:smoke` PASS（CRUD 5/5，chat 14/14）。
- `npx playwright test --config e2e/playwright.desktop.config.ts --workers=1` PASS（45 passed，2 skipped）。
- `bash scripts/verify-governance-gate.sh ACCEPTANCE-REAL-FLOW-2026-06-01` PASS。

## 定向验收样本

### Mobile/PWA cloud

- `workspaceId=11175e6c-097c-47b9-ad6e-efc1db3de3b7`
- `sessionId=adc9f312-73e0-42e0-9f62-5a9061922e55`
- `chatStatus=200`
- agent 回复：`mobile cloud ok 1780289810933`
- 布局：`width=390, scrollWidth=390, height=844`

### 附件与 artifact

- `workspaceId=82f8f149-912d-4c4d-be23-717d8db63327`
- `sessionId=4440f116-2a5d-4ef4-a483-e284f9b0df5a`
- 附件：`acceptance-1780290185547.txt`
- 附件 contentRef：`message:28d3e25b-3cea-43c8-aa06-1fa5a1774b64`
- 验收令牌：`ATTACH_TOKEN_1780290185547`
- artifact title：`附件验收产物 1780290185547`
- artifact content：`附件令牌: ATTACH_TOKEN_1780290185547`

## 剩余风险

- 本轮自动化不把 Android Studio 原生模拟器作为阻塞项；Mobile/PWA 已使用 390x844 真实浏览器视口验证。
- opencli extension 和 CLI 有版本更新提示，但 doctor 连接状态为 OK，不影响当前验收。
- 附件当前限制 64KB 轻量文本上下文；后续大文件、二进制和对象存储应拆独立增强任务。

## 收尾记录

- 工作提交：`08440f7`、`dc4bd21`、`dc3e75d`、`c2cb16f`。
- Trellis 归档：`chore(task): archive 06-01-acceptance-real-e2e-uat`。
- Journal 记录：`chore: record journal`。
