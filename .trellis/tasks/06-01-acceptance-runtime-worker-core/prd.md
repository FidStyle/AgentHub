# 验收真实闭环 2：runtime worker 真实执行基座

## Goal

让 runtime worker 在验收环境中默认走真实 executor 或明确阻塞，不再用 `FakeExecutor`/`ScriptedRealExecutor` 作为产品成功证据。

## Requirements

- 保留 `FakeExecutor` 仅用于单元测试，不能作为 `dev:acceptance` 或 UAT 成功默认。
- `RUNTIME_EXECUTOR=real` 支持 Codex/Claude Code CLI，CLI 不存在或未登录要明确失败。
- worker 启动日志和 API 错误语义能说明当前 executor 模式。
- 参考 `refer_proj/AionUi`, `refer_proj/codeg`, `refer_proj/lobehub` 的 agent/runtime 状态机和 transport 设计。

## Acceptance Criteria

- [x] `createExecutor()` 默认策略对验收真实，不再静默 fake。
- [x] 单测覆盖 fake 仅测试、real CLI unavailable、配置错误。
- [x] `dev:acceptance`/文档/脚本不把 scripted 当产品成功。

## Verification Notes

- `apps/web/server/runtime-worker.ts#createExecutor()` 在无 `RUNTIME_EXECUTOR` 或 `RUNTIME_EXECUTOR=real` 时默认使用真实 CLI executor，`fake`/`script` 仅显式测试模式。
- `scripts/acceptance-env.mjs dev` 默认设置 `RUNTIME_EXECUTOR=real`，验收链路不再静默 fake/script。
- 本轮本地链路使用 Electron `RuntimeHost` + 真实 Claude CLI 跑通；远程 cloud 和 Mobile/PWA 链路使用 real executor 跑通并落库。
- 验证命令：`pnpm --filter @agenthub/web test -- __tests__/runtime __tests__/api/chat.test.ts` PASS（7 files / 31 tests）；`pnpm env:acceptance:smoke` PASS。

## References

- `research/contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md`
- `.trellis/spec/cross-layer/runtime-gateway-contract.md`
- `.trellis/spec/cross-layer/runtime-credential-boundary.md`
