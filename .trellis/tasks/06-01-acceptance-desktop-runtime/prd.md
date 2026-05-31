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

- [ ] Desktop type-check/build/test 通过。
- [ ] IPC/runtime execute/cancel/error 测试通过。
- [ ] Electron GUI 或等价 UAT 有证据。
- [ ] Web/Desktop 连通状态 smoke 通过。

## Likely Starting Evidence

- `apps/desktop/src/main/*`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/components/shell/DesktopAgentSession.tsx`
- `apps/desktop/__tests__/*`
- `e2e/tests/desktop/*`
