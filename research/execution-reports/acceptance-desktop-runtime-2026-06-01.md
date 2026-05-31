# Desktop 本地能力验收报告（2026-06-01）

## 结论

`06-01-acceptance-desktop-runtime` 已完成。Desktop 本地能力的类型检查、单测、构建和完整 Electron E2E 均通过；本轮主要修复的是验收测试与实际 Desktop 运行契约不一致的问题，没有把外部登录环境缺失写成假成功。

## 修复内容

- `e2e/tests/desktop/p0-entry-points.spec.ts`
  - Electron 启动时同步传入 `NODE_ENV=development` 和 `VITE_PORT=5177`，修复 Vite 端口为 5177 但主进程仍访问默认 5173 的问题。
  - 增加 `desktop-main-shell` 启动断言，避免空白页进入后续入口测试。
  - GitHub 登录错误断言改为匹配真实错误文案，避免 `.text-destructive` 同时命中红色计数徽标。
- `e2e/tests/desktop/desktop-main-shell.spec.ts`
  - 待接入 OpenCode 按当前真实按钮文案「不可进入」断言 disabled，不再使用旧文案。
- `e2e/tests/desktop/ui-alignment.spec.ts`
  - 配置页待接入诊断引导按真实文案断言。
  - 会话输入框测试回到「本地工作区」页，避免在「最近会话」页等待不存在的 composer。
- `e2e/tests/desktop/p0-auth-flow.spec.ts`
  - Web 登录 API 和构建后 Electron app 路径改为显式环境门槛；环境不存在时 `test.skip`，不伪造登录绑定。

## 验证证据

- `pnpm --filter @agenthub/desktop type-check`：PASS。
- `pnpm --filter @agenthub/desktop test`：PASS，5 files / 23 tests。
- `pnpm --filter @agenthub/desktop build`：PASS。
- `npx playwright test --config e2e/playwright.desktop.config.ts --workers=1`：PASS，45 passed，2 skipped。

## Skipped 说明

- `p0-auth-flow.spec.ts` 的 login-intent/bind-status 需要 `WEB_BASE_URL` 指向可访问 Web 服务。
- Electron 登录按钮构建态验证需要 `DESKTOP_APP_PATH` 指向已构建 Electron app。
- 这两项是外部集成环境门槛；Desktop GUI、导航、runtime 检测、IPC/runtime execute/cancel/error、device-channel fallback、错误态和视觉门禁已由通过项覆盖。
