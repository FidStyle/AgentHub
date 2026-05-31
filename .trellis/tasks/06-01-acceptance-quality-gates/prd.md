# 验收硬化 1：质量门禁与测试覆盖修复

## Goal

让基础质量门禁真实可信：lint、type-check、build、unit/integration test 不再假绿或漏跑。

## Shared Contract

- `research/contracts/ACCEPTANCE-HARDENING-2026-06-01.md`

## Requirements

- 修复 `pnpm lint` 当前硬失败。
- Web Vitest 必须能运行并修复现有失败。
- 根 `pnpm test` 或验收脚本必须纳入 Web tests，不能只跑 shared/desktop/mobile。
- Mobile `type-check`/`build` echo skip 必须改为真实可执行检查，或重命名为诚实的非通过脚本并提供验收替代。
- Next lint deprecation 和 ESLint config warning 不一定阻塞，但不能掩盖 exit 1。

## Acceptance Criteria

- [ ] `pnpm lint` exit 0。
- [ ] `pnpm type-check` exit 0，且没有核心假通过。
- [ ] Web Vitest exit 0。
- [ ] 根测试/验收测试命令覆盖 Web。
- [ ] 记录失败根因、修复点、命令输出摘要。

## Likely Starting Evidence

- `apps/desktop/src/main/runtime/local-adapter.ts`
- `apps/web/__tests__/api/messages.test.ts`
- `apps/web/__tests__/api/workspaces.test.ts`
- `apps/web/__tests__/api/sessions.test.ts`
- `apps/web/package.json`
- `apps/mobile/package.json`
