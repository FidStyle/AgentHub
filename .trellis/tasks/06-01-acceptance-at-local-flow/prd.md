# 验收真实闭环 3：核心 @ 对话本地链路

## Goal

实现 `local_desktop` 工作区的真实 `@角色` 对话链路：Web `/api/chat` -> Gateway -> DeviceChannel -> Electron `runtime_invoke` -> Desktop CLI -> runtime event -> Web SSE -> message 落库。

## Requirements

- `gateway.ts` 的 user_local 分支不能只返回 `tunnel_ready`。
- `ws-gateway.ts` 必须处理 Desktop `response` 和 `runtime_event`，按 request/runtime session 路由。
- Desktop `RuntimeHost` 执行结果要能映射成 Web `runtime_output/runtime_completed/runtime_failed`。
- CLI 未安装/未登录/超时必须是失败态，不得落 fake agent 回复。

## Acceptance Criteria

- [x] 本地链路成功时 Web 可见 agent 回复并刷新保留。
- [x] 本地链路失败时 Web 显示中文错误且 DB 不落成功 agent 回复。
- [x] Electron 层有自动化或 opencli UAT 证据。

## Verification Notes

- 2026-06-01：真实 acceptance 环境下跑通 `local_desktop` 核心 @ 链路：Web `/api/chat` -> Gateway -> Redis 跨进程 DeviceChannel relay -> Electron `RuntimeHost` -> `claude --print` -> runtime_event -> SSE -> agent message 落库。
- SSE 证据包含 `gateway_connected`、`tunnel_connected`、`runtime_status: tunnel_ready/running`、`runtime_output`、`runtime_completed`、`done`。
- DB 证据：最新 `runtime_sessions.status=completed`；`runtime_logs` 6 条事件按 seq 落库；`messages` 有用户消息和 agent 消息。
- 验证命令：`npx playwright test --config e2e/playwright.desktop.config.ts --workers=1` 45 passed / 2 skipped；`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/desktop type-check` PASS；`pnpm env:acceptance:smoke` PASS。

## References

- `research/contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md`
- `.trellis/spec/cross-layer/runtime-gateway-contract.md`
- `.trellis/spec/cross-layer/runtime-credential-boundary.md`
