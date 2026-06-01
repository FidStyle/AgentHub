# 验收真实闭环 2：runtime worker 真实执行基座

## Goal

让 runtime worker 在验收环境中默认走真实 executor 或明确阻塞，不再用 `FakeExecutor`/`ScriptedRealExecutor` 作为产品成功证据。

## Requirements

- 保留 `FakeExecutor` 仅用于单元测试，不能作为 `dev:acceptance` 或 UAT 成功默认。
- `RUNTIME_EXECUTOR=real` 支持 Codex/Claude Code CLI，CLI 不存在或未登录要明确失败。
- worker 启动日志和 API 错误语义能说明当前 executor 模式。
- 参考 `refer_proj/AionUi`, `refer_proj/codeg`, `refer_proj/lobehub` 的 agent/runtime 状态机和 transport 设计。

## Acceptance Criteria

- [ ] `createExecutor()` 默认策略对验收真实，不再静默 fake。
- [ ] 单测覆盖 fake 仅测试、real CLI unavailable、配置错误。
- [ ] `dev:acceptance`/文档/脚本不把 scripted 当产品成功。

## References

- `research/contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md`
- `.trellis/spec/cross-layer/runtime-gateway-contract.md`
- `.trellis/spec/cross-layer/runtime-credential-boundary.md`
