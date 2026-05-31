# 验收硬化 3：Web 主链路真实回归

## Goal

确保 Web 主端真实用户链路从入口到消息回复、产物/编排展示、刷新恢复全部可验收。

## Shared Contract

- `research/contracts/ACCEPTANCE-HARDENING-2026-06-01.md`

## Requirements

- 登录/测试认证、workspace list、新建 workspace、进入 workspace、session 创建/切换全部走真实 DB/API。
- Chat 发送必须调用 `/api/chat`，有 worker 时可见 agent 回复并落库；无 worker 时立即中文错误态。
- Role Agent、Artifact Panel、Orchestrator Panel 使用真实 API 数据。
- reload 后用户消息、agent 回复、role badge、context/output/orchestrator 状态恢复。
- E2E 不得只断言可见或 HTTP 200。

## Acceptance Criteria

- [ ] Web 主链路 E2E worker-mode 通过。
- [ ] Web no-worker 错误态 E2E 通过。
- [ ] Artifact/Orchestrator 数据一致性 E2E 通过。
- [ ] 视觉布局断言通过。
- [ ] 相关 API/integration 测试通过。

## Likely Starting Evidence

- `apps/web/app/api/chat/route.ts`
- `apps/web/lib/runtime/gateway.ts`
- `apps/web/components/workspace/*`
- `apps/web/components/orchestrator/*`
- `e2e/tests/web/*`
- `e2e/tests/artifact.spec.ts`
- `e2e/tests/messaging.spec.ts`
- `e2e/tests/workspace.spec.ts`
