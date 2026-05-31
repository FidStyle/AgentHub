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

- [x] PWA mobile E2E worker/no-worker 路径通过。
- [x] RN chat client/config tests 通过。
- [x] Mobile type/build/check 不再假绿。
- [x] RN GUI 范围明确：Metro 启动入口已验证，设备/模拟器 GUI 不纳入本次自动验收范围。

## Execution Notes

- Mobile PWA worker-mode 已覆盖 `/m` → workspace → session → `/api/chat` → 可见非 echo agent 回复 → reload 持久化。
- Mobile PWA no-worker 已覆盖 `/api/chat` 调用后明确中文错误态，不静默只落用户消息。
- 修复 PWA service worker：开发/E2E 环境不注册 service worker，生产 `sw.js` 不再预缓存不存在的 `/m/sessions`。
- 修复 Mobile PWA E2E 过期文案和不稳定定位：导航文案为「授权」，中文 UI 断言改用 heading/link 语义定位，审批页首次编译通过 request 预热避免 Next dev Fast Refresh 打断导航。
- 修复 RN 启动假入口：`apps/mobile/package.json` 的 `start` 从不存在的 `expo start` 改为 `react-native start`，并补 `apps/mobile/metro.config.js`。

## Verification

- `RUNTIME_E2E=1 npx playwright test --config e2e/playwright.config.ts --project=mobile-pwa --workers=1 tests/mobile/mobile-chat-deliver.spec.ts tests/mobile/mobile-pwa.spec.ts tests/mobile/visual-gate.spec.ts`：13 passed。
- `RUNTIME_E2E_NOWORKER=1 npx playwright test --config e2e/playwright.config.ts --project=mobile-pwa --workers=1 tests/mobile/mobile-chat-deliver.spec.ts`：1 passed。
- `pnpm --filter @agenthub/mobile test`：1 file / 5 tests PASS。
- `pnpm --filter @agenthub/mobile type-check`：PASS。
- `pnpm --filter @agenthub/mobile build`：PASS。
- `pnpm --filter @agenthub/mobile exec react-native start --help`：PASS，React Native CLI start 可用。
- `pnpm --filter @agenthub/mobile start -- --port 8088 --no-interactive`：Metro 启动到 `Dev server ready` 后手动 SIGTERM 停止；该命令实际使用 RN CLI 默认端口 8081，端口参数因 pnpm 额外 `--` 未透传，后续人工运行可直接使用 `pnpm --filter @agenthub/mobile exec react-native start --port 8088 --no-interactive`。
- 扫描 `apps/mobile apps/web/app/m e2e/tests/mobile`：未发现产品代码中的 `setTimeout`、`mobile-sess-1`、`收到:` 或本地 echo 假回复残留。

## Report

- `research/execution-reports/acceptance-mobile-surfaces-2026-06-01.md`

## Likely Starting Evidence

- `apps/web/app/m/*`
- `apps/mobile/src/screens/ChatScreen.tsx`
- `apps/mobile/src/lib/chatClient.ts`
- `apps/mobile/src/lib/config.ts`
- `apps/mobile/src/lib/__tests__/chatClient.test.ts`
- `e2e/tests/mobile/*`
