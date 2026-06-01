# 验收真实闭环 4：核心 @ 对话远程链路

## Goal

实现并验证 `cloud` 工作区远程 runtime 链路：`@角色` 消息经 Gateway/Redis/worker/真实 executor 返回非 echo agent 回复，落库并刷新恢复。

## Requirements

- runtime worker 采用真实 executor 配置；无凭证时明确阻塞。
- E2E 必须断言 agent 回复非空、非 echo、带角色上下文、刷新后存在。
- Mobile/PWA 复用同一 `/api/chat` 语义。

## Acceptance Criteria

- [ ] Web cloud 工作区核心 `@` 流程跑通。
- [ ] Mobile/PWA 至少覆盖浏览器视口真实 API 流程。
- [ ] runtime_logs 与 messages 可交叉验证。

## References

- `research/contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md`
- `.trellis/spec/cross-layer/runtime-gateway-contract.md`
