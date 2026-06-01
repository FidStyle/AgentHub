# 验收真实闭环总控：opencli、runtime worker、核心 @ 流程

## Goal

按 `research/contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md` 收口验收前真实链路：Web/Electron 用 opencli 可验真，本地与远程 runtime 都能跑通核心 `@角色` 对话，附件和 artifact 不再是假入口，最终 UAT 证据可复现。

## What I already know

- 用户明确要求不再按 MVP 降级；不能接受假完成、mock 完成、TODO 完成。
- `$write-help-doc` 证明 opencli 可用于浏览器控制、状态复用、DOM 定位和截图；本项目应维护自己的 Web/Electron UAT skill。
- 代码事实：`runtime-worker.ts` 默认 `FakeExecutor`，`gateway.ts` 的 `user_local` 只到 `tunnel_ready`，`ws-gateway.ts` 没有把 Desktop response/runtime event 路由回 runtime session。
- 代码事实：Web 附件只记录文件名并拼进 prompt，不上传内容。
- 代码事实：artifact 面板从 messages/metadata 派生展示，缺少 durable artifact 产出合同。
- `opencli` 本机已安装，支持 browser 命令和 app adapters。

## Requirements

- 建立并使用 `.agents/skills/agenthub-opencli-uat`。
- 远程链路：`cloud` 工作区经 Gateway + worker + real executor 跑通，不能默认 fake。
- 本地链路：`local_desktop` 工作区经 DeviceChannel 到 Electron Desktop 执行，并回流 SSE/DB。
- 对话：`@角色` 的 system prompt、roleAgentId、mentions、回复落库、刷新恢复必须真实。
- 附件：上传内容必须被 API/runtime 使用或明确阻塞，不能只传文件名。
- artifact：最终产物必须 durable，可被后续自动部署消费。

## Acceptance Criteria

- [x] 总合同和 6 个子任务 PRD/context 都已建立。
- [x] 本地链路与远程链路各有自动化或 opencli UAT 证据。
- [x] `FakeExecutor` 不再是验收默认成功路径。
- [x] 附件和 artifact 有真实存储/读取/展示证据。
- [x] tracker、ledger、execution report、治理门禁同步。

## Verification Notes

- 本地链路、远程链路、Mobile/PWA、附件、artifact、opencli、Electron 验收证据已分别记录在 6 个子任务 PRD 和 `research/execution-reports/acceptance-real-flow-2026-06-01-report.md`。
- 最终治理门禁命令：`bash scripts/verify-governance-gate.sh ACCEPTANCE-REAL-FLOW-2026-06-01`。

## Subtasks

- `06-01-acceptance-opencli-browser-electron`
- `06-01-acceptance-runtime-worker-core`
- `06-01-acceptance-at-local-flow`
- `06-01-acceptance-at-remote-flow`
- `06-01-acceptance-attachments-artifacts`
- `06-01-acceptance-real-e2e-uat`

## References

- `research/contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md`
- `research/contracts/ACCEPTANCE-HARDENING-2026-06-01.md`
- `.trellis/spec/guides/end-to-end-contract-planning.md`
- `.trellis/spec/cross-layer/runtime-gateway-contract.md`
- `.trellis/spec/cross-layer/runtime-credential-boundary.md`
- `.agents/skills/agenthub-opencli-uat/SKILL.md`
