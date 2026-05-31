# 验收硬化 3：Web 主链路真实回归执行报告

## 范围

任务：`.trellis/tasks/06-01-acceptance-web-core-flow/`

合同：`research/contracts/ACCEPTANCE-HARDENING-2026-06-01.md`

目标是用真实 DB/API/Auth/runtime worker 验证 Web 主端链路：workspace、session、chat、Role Agent、Artifact、Orchestrator、reload，以及无 worker 错误态。

## 修复点

- `apps/web/components/workspace/ArtifactPanel.tsx`：产物 Tab 纳入 `result_card`，避免真实运行结果只出现在变更而不出现在产物。
- `apps/web/app/api/plans/route.ts`：修复本地 Postgres adapter 写入 `plan_nodes.depends_on uuid[]` 时的 malformed array literal，改为写入 Postgres uuid array literal。
- `e2e/tests/artifact.spec.ts`、`e2e/tests/web/artifact-panel-data.spec.ts`：按实际 UI 更新 Role Agents 位置（「上下文」Tab），并用真实 API 自建 workspace/session 数据。
- `e2e/tests/web/web-orchestrator-ui.spec.ts`：按实际 UI 更新 Orchestrator 位置（「变更」Tab），自建真实 workspace/session/plan/action，并使用 UUID plan node id。
- `e2e/tests/web/p0-main-flow.spec.ts`：创建 workspace 后使用真实 POST 响应 id 进入工作台，避免列表刷新/排序导致过期选择器失败。

## 验证结果

Worker-mode：

```bash
set -a; . docker/.p0-test.env; set +a
RUNTIME_E2E=1 npx playwright test --config e2e/playwright.config.ts --project=web-desktop --workers=1 \
  tests/web/p0-main-flow.spec.ts \
  tests/messaging.spec.ts \
  tests/artifact.spec.ts \
  tests/web/web-orchestrator-ui.spec.ts \
  tests/web/artifact-panel-data.spec.ts
```

结果：7 passed。

No-worker：

```bash
set -a; . docker/.p0-test.env; set +a
RUNTIME_E2E_NOWORKER=1 npx playwright test --config e2e/playwright.config.ts --project=web-desktop --workers=1 \
  tests/web/role-chat-no-worker.spec.ts \
  tests/messaging.spec.ts
```

结果：2 passed。

## 结论

Web 主链路 worker-mode 与 no-worker 错误态已通过真实验收环境验证。当前仍不代表整体验收完成；Desktop runtime、Mobile surfaces 和 Final UAT/governance 继续按后续子任务推进。
