# 最终 UAT 与治理证据报告（2026-06-01）

## 结论

`ACCEPTANCE-HARDENING-2026-06-01` 六个 P0 子任务已完成。当前代码通过根级 lint/type-check/test/build、验收环境 smoke、Web worker/no-worker E2E、Desktop Electron E2E、Mobile PWA worker/no-worker E2E、RN 逻辑与启动入口验证。

## 自动化证据

- `pnpm lint`：PASS。
- `pnpm type-check`：PASS。
- `pnpm test`：PASS，shared 27 + mobile 5 + web 112 + desktop 23。
- `pnpm build`：PASS。
- `pnpm dev:acceptance` + `pnpm env:acceptance:smoke`：PASS，CRUD 5/5，chat 14/14。
- Web worker-mode E2E：7 passed。
- Web no-worker E2E：2 passed。
- Desktop：`pnpm --filter @agenthub/desktop type-check/test/build` PASS；完整 Electron E2E 45 passed，2 skipped。
- Mobile：worker-mode 13 passed；no-worker 1 passed；`pnpm --filter @agenthub/mobile test/type-check/build` PASS；React Native CLI start help 和 Metro 启动入口通过。

## 已关闭问题

- 质量门禁：Desktop lint hard failure、Web Vitest failure、根 `pnpm test` 漏 Web、Mobile type/build echo skip。
- 环境门禁：验收环境从手工拼装改为 `pnpm env:acceptance:*` / `pnpm dev:acceptance`。
- Runtime：修复 Redis subscribe/enqueue 竞态，避免 worker 快速输出丢失。
- Web：`ArtifactPanel` 显示 `result_card`；`/api/plans` 修复 Postgres `uuid[]` 写入；Web E2E 去外部 env 依赖和过期 Tab 定位。
- Desktop：修复 E2E 启动端口、过期待接入文案、诊断引导和 composer 页面定位。
- Mobile：修复 PWA service worker 开发态导航干扰、无效 `/m/sessions` 预缓存、移动导航测试定位、RN `expo start` 假入口和缺 Metro 配置。

## 残留风险

- Desktop 登录绑定 E2E 有 2 个 skipped：需要外部 Web 登录服务或 `DESKTOP_APP_PATH` 构建应用路径。Desktop GUI、runtime、IPC、device-channel fallback、错误态和视觉门禁已由通过项覆盖。
- RN 真实设备/模拟器 GUI 未纳入本次自动验收；已覆盖 RN chat client/config、type/build、React Native CLI/Metro 启动入口和 Mobile PWA 浏览器用户态。
- Runtime worker 验收使用 `RUNTIME_EXECUTOR=script` 的确定性执行器；这是验收环境的真实队列/DB/API/worker 链路，不等同于生产模型执行质量评估。

## 治理状态

- `research/project-tracker.md` 已同步最终状态和证据。
- `research/regression-ledger.md` 已补最终验收硬化闭环记录。
- 已提交本次变更，并重跑 `bash scripts/verify-governance-gate.sh ACCEPTANCE-HARDENING-2026-06-01`：PASS。
