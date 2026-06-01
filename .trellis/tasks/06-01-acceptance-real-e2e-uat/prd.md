# 验收真实闭环 6：最终 E2E/UAT 治理证据

## Goal

整合 Web/Electron/Mobile/PWA 的最终验收证据，确保合同、tracker、ledger、execution report、治理门禁和 commit 全部一致。

## Requirements

- 使用 opencli/Playwright 从真实入口跑 Web/Electron。
- E2E 不能只 `--list` 或 `test.skip` 证明通过。
- 记录真实命令、环境变量、截图、DB/API 交叉验证和失败/阻塞原因。

## Acceptance Criteria

- [x] 本地和远程核心 `@` 流程均有证据。
- [x] 附件/artifact 有证据。
- [x] `research/project-tracker.md`、`research/regression-ledger.md` 更新。
- [x] `scripts/verify-governance-gate.sh ACCEPTANCE-REAL-FLOW-2026-06-01` 通过。

## Verification Notes

- 本地 Desktop：commit `08440f7` 已验证 Web `/api/chat` -> Gateway -> Redis relay -> Desktop DeviceChannel -> Electron `RuntimeHost` -> 真实 Claude CLI -> SSE -> DB。
- 远程 cloud：commit `dc4bd21` 已验证 Web + 390x844 Mobile/PWA cloud `/api/chat` -> Gateway -> Redis -> runtime worker -> real executor -> SSE -> DB。
- 附件/artifact：commit `dc3e75d` 已验证 `/api/attachments`、附件上下文注入 runtime、artifact durable message 和右侧面板刷新可见。
- 截图证据：`e2e/artifacts/opencli-uat/web-opencli-home.png`、`web-workspace-after-local-flow.png`、`mobile-cloud-real-flow-390x844.png`、`attachment-artifact-panel.png`。
- 最终报告：`research/execution-reports/acceptance-real-flow-2026-06-01-report.md`。

## References

- `research/contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md`
- `.agents/skills/agenthub-opencli-uat/SKILL.md`
- `.trellis/spec/guides/end-to-end-contract-planning.md`
