# 验收真实闭环 6：最终 E2E/UAT 治理证据

## Goal

整合 Web/Electron/Mobile/PWA 的最终验收证据，确保合同、tracker、ledger、execution report、治理门禁和 commit 全部一致。

## Requirements

- 使用 opencli/Playwright 从真实入口跑 Web/Electron。
- E2E 不能只 `--list` 或 `test.skip` 证明通过。
- 记录真实命令、环境变量、截图、DB/API 交叉验证和失败/阻塞原因。

## Acceptance Criteria

- [ ] 本地和远程核心 `@` 流程均有证据。
- [ ] 附件/artifact 有证据。
- [ ] `research/project-tracker.md`、`research/regression-ledger.md` 更新。
- [ ] `scripts/verify-governance-gate.sh ACCEPTANCE-REAL-FLOW-2026-06-01` 通过。

## References

- `research/contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md`
- `.agents/skills/agenthub-opencli-uat/SKILL.md`
- `.trellis/spec/guides/end-to-end-contract-planning.md`
