# Milestone: adhoc-real-runtime-executor — 真实可插拔 RuntimeExecutor 接入

**Completed**: 2026-05-30
**Type**: adhoc (self-contained, no successor)
**Task**: RT-REAL-EXEC-001
**Artifacts**: 5 (analyze: 1, plan: 1, execute: 1, verify: 1, review: 1)

## Key Outcomes
- `CliRuntimeExecutor` 接入真实 claude/codex CLI：`spawn` + readline 流式 stdout→ExecutorChunk
- CLI 二进制缺失 / spawn 失败 → `ExecutorUnavailableError`（code=`executor_unavailable`），worker 转 `runtime_failed`，杜绝假成功
- 凭证仅经子进程 `env` 注入；stderr 仅 drain 不外发；测试以序列化断言验证不泄漏
- `createExecutor()` 工厂按 `RUNTIME_EXECUTOR` env 选择，默认 `FakeExecutor` → gateway 零回归
- 验收三门全过：verify 6 truths VERIFIED / 0 gaps；review PASS / 0 blocking；test 7/7

## Learnings
- 真实 executor 接入复用既有 `RuntimeExecutor` 接口即可，零接口改动是保持 Gateway 架构稳定的关键
- 测试真实 CLI executor 无需付费/凭证：用「缺失二进制」走 unavailable 路径 + 注入式 stub 走成功/失败路径，覆盖完整
- 子进程 stderr 即便不外发也必须 drain，否则 chatty CLI 填满 pipe buffer 会阻塞

## Boundary Compliance
未改 Gateway 总架构；未重开 P1-RT 里程碑；无托管平台依赖；无真实付费 API 调用。

## Deferred (非本期)
- D1：真实端到端 CLI 会话（需凭证 + 付费）
- D3：CLI 输出结构化解析

## Next Milestone
Project idle — adhoc 里程碑自包含，无后继。后续真实端到端 CLI 会话 + worker 池扩展为独立范围。
