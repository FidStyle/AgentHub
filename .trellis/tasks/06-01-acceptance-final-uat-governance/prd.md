# 验收硬化 6：最终 UAT 与治理证据

## Goal

完成最终自动化与人工验收，更新公开 tracker/ledger/report，通过治理门禁，形成可交付结论。

## Shared Contract

- `research/contracts/ACCEPTANCE-HARDENING-2026-06-01.md`

## Requirements

- 汇总前五个子任务的命令、结果、截图/报告。
- 跑完整验收命令集。
- 更新 `research/project-tracker.md`、`research/regression-ledger.md`、execution report。
- 运行治理门禁。
- Codex 独立复核，不接受核心链路 deferred。

## Acceptance Criteria

- [x] 所有子任务完成。
- [x] execution report 完整。
- [x] tracker/ledger 同步。
- [x] governance gate exit 0（本次变更提交后重跑）。
- [x] 最终验收结论列出残留风险和可接受范围。

## Execution Notes

- 汇总并复核前五个子任务报告：质量门禁、验收环境、Web 主链路、Desktop 本地能力、Mobile PWA/RN。
- 重新运行根级 `pnpm lint`、`pnpm type-check`、`pnpm test`、`pnpm build`，均通过。
- 启动 `pnpm dev:acceptance` 后重跑 `pnpm env:acceptance:smoke`，CRUD 5/5、chat 14/14 通过。
- 治理门禁第一次运行失败，原因符合预期：工作区尚未提交，且 tracker 还未标记最终完成；补齐最终报告和 tracker/ledger 并提交后，治理门禁重跑通过。

## Verification

- `pnpm lint`：PASS。
- `pnpm type-check`：PASS。
- `pnpm test`：PASS（shared 27 + mobile 5 + web 112 + desktop 23）。
- `pnpm build`：PASS。
- `pnpm env:acceptance:smoke`（在 `pnpm dev:acceptance` 运行中）：PASS，CRUD 5/5，chat 14/14。
- `bash scripts/verify-governance-gate.sh ACCEPTANCE-HARDENING-2026-06-01`：PASS。
- Web E2E：worker-mode 7 passed；no-worker 2 passed。
- Desktop E2E：45 passed，2 skipped（外部登录环境门槛）。
- Mobile E2E：worker-mode 13 passed；no-worker 1 passed。

## Report

- `research/execution-reports/acceptance-final-uat-governance-2026-06-01.md`

## Likely Starting Evidence

- `scripts/verify-governance-gate.sh`
- `research/project-tracker.md`
- `research/regression-ledger.md`
- `research/execution-reports/`
