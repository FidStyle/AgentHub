# 验收硬化 4：Desktop 本地能力验收

## Goal

确保 Desktop 本地能力端不再有假交互、IPC no-handler、runtime 诊断不真实或错误态不可理解的问题。

## Shared Contract

- `research/contracts/ACCEPTANCE-HARDENING-2026-06-01.md`

## Requirements

- Runtime doctor 检查 CLI path/version/auth/launchable。
- Desktop renderer 通过 preload/main IPC 调真实 runtime execute/cancel。
- stdout/stderr/exitCode 显示为真实活动记录，失败态明确。
- device channel active/fallback handler 稳定，不能暴露底层 no-handler。
- local workspace operability 与 Web runtime status 一致。

## Acceptance Criteria

- [x] Desktop type-check/build/test 通过。
- [x] IPC/runtime execute/cancel/error 测试通过。
- [x] Electron GUI 或等价 UAT 有证据。
- [x] Web/Desktop 连通状态 smoke 通过。

## Execution Notes

- 修复 Desktop E2E 启动端口契约：`p0-entry-points.spec.ts` 启动 Vite 使用 5177 时同步传 `VITE_PORT=5177` 给 Electron 主进程，避免实际渲染仍访问默认 5173 导致整组入口测试假失败。
- 修复过期断言：待接入 OpenCode 当前真实按钮文案为「不可进入」，测试不再查旧的「待接入/进入会话」按钮；配置页诊断引导按当前真实文案断言「未完成真实检测/请先重新检测本地 Runtime」。
- 修复页面定位误差：会话输入框属于「本地工作区」页，不属于「最近会话」页；测试改回真实页面。
- 修复 GitHub 登录错误断言过宽：不再用 `.text-destructive` 匹配红色徽标，只匹配实际登录错误文案。
- `p0-auth-flow.spec.ts` 对外部 Web 服务和构建后的 Electron app 做显式环境门槛；缺少 `WEB_BASE_URL` 服务或 `DESKTOP_APP_PATH` 时跳过，不伪造绑定成功。

## Verification

- `pnpm --filter @agenthub/desktop type-check`：PASS。
- `pnpm --filter @agenthub/desktop test`：5 files / 23 tests PASS。
- `pnpm --filter @agenthub/desktop build`：PASS。
- `npx playwright test --config e2e/playwright.desktop.config.ts --workers=1`：45 passed，2 skipped。Skipped 项均为外部登录集成环境门槛：Web 服务 login-intent/bind-status、`DESKTOP_APP_PATH` 构建应用路径；Desktop GUI、导航、runtime 检测、IPC 单测、device-channel fallback、错误态、视觉门禁均已覆盖通过。

## Report

- `research/execution-reports/acceptance-desktop-runtime-2026-06-01.md`

## Likely Starting Evidence

- `apps/desktop/src/main/*`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/components/shell/DesktopAgentSession.tsx`
- `apps/desktop/__tests__/*`
- `e2e/tests/desktop/*`
