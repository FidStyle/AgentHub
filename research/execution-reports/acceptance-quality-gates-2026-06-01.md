# 验收硬化 1：质量门禁与测试覆盖执行报告

## 范围

任务：`.trellis/tasks/06-01-acceptance-quality-gates/`

合同：`research/contracts/ACCEPTANCE-HARDENING-2026-06-01.md`

目标是修复当前硬红和假绿质量门禁：Desktop lint、Web Vitest、根测试漏 Web、Mobile type/build echo skip。

## 修复点

- `apps/desktop/src/main/runtime/local-adapter.ts`：将 ANSI escape 清洗正则从 literal control regex 改为构造式 `RegExp`，修复 ESLint `no-control-regex`。
- `apps/web/package.json`：新增真实 `test` 脚本，使根 `pnpm test` 收集 Web Vitest；新增显式 `test:integration`。
- `apps/web/vitest.config.ts`：普通 Vitest 默认排除 DB integration；需要真实 DB 时用 `RUN_DB_INTEGRATION=1` 显式运行。
- `apps/web/__tests__/api/messages.test.ts`：未授权断言同步为实现中的中文 `{ error: '未授权' }`。
- `apps/web/__tests__/api/sessions.test.ts`：测试桩补齐 `.eq().eq().single()` 查询链，匹配 sessions route 实际 workspace ownership 查询。
- `apps/web/__tests__/api/workspaces.test.ts`：单测环境补最小 `DATABASE_URL`，避免 route 的 DB 配置门禁让 unit mock 测试误红。
- `apps/mobile/package.json`：`type-check` 改为 `tsc --noEmit`，`build` 改为 `pnpm type-check`，移除 echo skip。
- `apps/mobile/src/screens/ChatScreen.tsx` / `apps/mobile/tsconfig.json`：修复 RN 0.73 组件类型在当前 TypeScript 下的 JSX 兼容问题，保持真实 TS 检查可执行。

## 验证结果

- `pnpm --filter @agenthub/web test`：PASS，11 files / 112 tests。
- `pnpm --filter @agenthub/mobile type-check`：PASS。
- `pnpm --filter @agenthub/mobile build`：PASS，实际执行 `pnpm type-check`。
- `pnpm lint`：PASS。
- `pnpm type-check`：PASS。
- `pnpm test`：PASS，shared 27 + mobile 5 + web 112 + desktop 23 tests。

## 结论

第一项质量门禁已完成。当前只证明基础 lint/type-check/unit test 收集真实通过，不代表整体 P0 验收完成。剩余任务仍需继续覆盖真实环境、Web 主链路、Desktop runtime、Mobile surfaces 和最终 UAT/governance。
