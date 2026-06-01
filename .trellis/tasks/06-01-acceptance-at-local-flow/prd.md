# 验收真实闭环 3：核心 @ 对话本地链路

## Goal

实现 `local_desktop` 工作区的真实 `@角色` 对话链路：Web `/api/chat` -> Gateway -> DeviceChannel -> Electron `runtime_invoke` -> Desktop CLI -> runtime event -> Web SSE -> message 落库。

## Requirements

- `gateway.ts` 的 user_local 分支不能只返回 `tunnel_ready`。
- `ws-gateway.ts` 必须处理 Desktop `response` 和 `runtime_event`，按 request/runtime session 路由。
- Desktop `RuntimeHost` 执行结果要能映射成 Web `runtime_output/runtime_completed/runtime_failed`。
- CLI 未安装/未登录/超时必须是失败态，不得落 fake agent 回复。

## Acceptance Criteria

- [ ] 本地链路成功时 Web 可见 agent 回复并刷新保留。
- [ ] 本地链路失败时 Web 显示中文错误且 DB 不落成功 agent 回复。
- [ ] Electron 层有自动化或 opencli UAT 证据。

## References

- `research/contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md`
- `.trellis/spec/cross-layer/runtime-gateway-contract.md`
- `.trellis/spec/cross-layer/runtime-credential-boundary.md`
