# 验收硬化 5：Mobile PWA 与 RN 真实闭环

## Goal

确保 Mobile/PWA 与原生 RN 不使用假回显，配置、发送、错误态和刷新恢复符合真实产品口径。

## Shared Contract

- `research/contracts/ACCEPTANCE-HARDENING-2026-06-01.md`

## Requirements

- PWA `/m` 会话发送走 `/api/chat`，回复或错误态可见。
- 原生 RN 缺配置时显示中文引导；配置存在时通过真实 API/SSE/XHR 链路发送。
- 不允许 `setTimeout`、本地 echo 或硬编码 session 冒充 agent 回复。
- Mobile/RN 的 type/test/build/check 必须诚实。
- 如验收范围包含 RN GUI，必须补设备/模拟器 UAT 证据。

## Acceptance Criteria

- [ ] PWA mobile E2E worker/no-worker 路径通过。
- [ ] RN chat client/config tests 通过。
- [ ] Mobile type/build/check 不再假绿。
- [ ] RN GUI 范围明确：已验收或明确不在本次人工验收范围。

## Likely Starting Evidence

- `apps/web/app/m/*`
- `apps/mobile/src/screens/ChatScreen.tsx`
- `apps/mobile/src/lib/chatClient.ts`
- `apps/mobile/src/lib/config.ts`
- `apps/mobile/src/lib/__tests__/chatClient.test.ts`
- `e2e/tests/mobile/*`
