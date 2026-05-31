# Mobile PWA 与 RN 真实闭环验收报告（2026-06-01）

## 结论

`06-01-acceptance-mobile-surfaces` 已完成。Mobile PWA 的 worker/no-worker 主链路通过真实 DB/API/runtime 验收；RN 原生聊天 client/config、type-check、build 均通过；原先不可用的 `expo start` 假入口已改为 React Native CLI + Metro 配置。

## 修复内容

- `apps/web/app/m/layout.tsx`
  - service worker 仅在 production 注册，避免开发/E2E 环境劫持导航。
- `apps/web/public/sw.js`
  - 移除不存在的 `/m/sessions` 预缓存路径，改为缓存真实存在的 `/m/approve`、`/m/preview`。
- `e2e/tests/mobile/mobile-pwa.spec.ts`
  - 导航文案从「审批」更新为当前 UI 的「授权」。
  - 工作区/AgentHub 断言改用 heading 语义定位，避免共享 DB 中工作区名称造成 strict mode 冲突。
  - 审批页测试先用 request 预热 `/m/approve`，避免 Next dev 首次编译 Fast Refresh 打断导航。
- `apps/mobile/package.json`
  - `start` 从不可用的 `expo start` 改为 `react-native start`。
- `apps/mobile/metro.config.js`
  - 新增 monorepo Metro 配置，补齐 RN dev server 启动入口。

## 验证证据

- `RUNTIME_E2E=1 npx playwright test --config e2e/playwright.config.ts --project=mobile-pwa --workers=1 tests/mobile/mobile-chat-deliver.spec.ts tests/mobile/mobile-pwa.spec.ts tests/mobile/visual-gate.spec.ts`：PASS，13 passed。
- `RUNTIME_E2E_NOWORKER=1 npx playwright test --config e2e/playwright.config.ts --project=mobile-pwa --workers=1 tests/mobile/mobile-chat-deliver.spec.ts`：PASS，1 passed。
- `pnpm --filter @agenthub/mobile test`：PASS，1 file / 5 tests。
- `pnpm --filter @agenthub/mobile type-check`：PASS。
- `pnpm --filter @agenthub/mobile build`：PASS。
- `pnpm --filter @agenthub/mobile exec react-native start --help`：PASS。
- `pnpm --filter @agenthub/mobile start -- --port 8088 --no-interactive`：Metro 启动到 `Dev server ready` 后人工 SIGTERM 停止。

## 范围说明

本次自动验收覆盖 Mobile PWA 浏览器用户态和 RN 逻辑/启动入口。RN 真实设备或模拟器 GUI 未纳入本次自动验收；当前环境未启动 iOS/Android 模拟器。原生链路禁止假回显的核心约束由 `chatClient.test.ts`、type-check/build、Metro 启动入口和代码扫描覆盖。
