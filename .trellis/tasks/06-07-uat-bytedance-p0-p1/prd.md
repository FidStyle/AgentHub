# 全真实逐步 UAT 复核 Bytedance P0/P1

## Goal

按用户要求重新跑一条不依赖历史 pass 的 Bytedance P0/P1 全真实逐步 UAT：从真实用户入口开始操作，每个关键步骤后同步验证 UI、API、DB/runtime/action/artifact 状态。若任一步失败，按失败记录，不把里程碑断言或历史截图替代为完成。

## What I already know

- 用户明确要求“全真实”，并指出之前的 strict gate 不是“每做一步就验证状态”的真实用户验收。
- 最高产品事实源仍为 `bytedance_init_prd.md` 与 `bytedance_init_video_txt.txt`。
- 本轮复核引用既有合同 `research/contracts/BYTEDANCE-P0-P1-FINAL-COMPLETION-GATE.md`，但不复用其结论。
- 既有 final run `STRICT-FINAL-P0P1-1780769350` 只作为对照样本，不作为本轮通过证据。
- 当前必须覆盖 Web、Mobile/PWA、Desktop/Electron；Electron 若缺 OpenCLI adapter，必须明确记录 fallback 或失败，不写成无条件通过。

## Requirements

- Fresh run：使用新的 run marker、workspace、session、artifact 证据目录。
- 用户路径：优先通过真实 Web UI 输入 prompt；如某一步必须用 API 准备状态，应在报告中标明“API setup”而不是“用户点击”。
- 每步验证：每个关键用户动作后都记录 UI 结果、API 读回、DB/runtime/action 状态或不可用原因。
- 权限分支：分别覆盖 full-control、manual allow、manual reject；不能用 full-control 代替手动审批分支。
- 三端读回：Web、Mobile/PWA、Desktop/Electron 均需真实入口或明确 fallback/blocked 证据。
- 治理复核：记录当前 `bash scripts/verify-governance-gate.sh BYTEDANCE-P0-P1-FINAL-COMPLETION-GATE` 的真实结果，不因 archive/journal 规则失败而隐藏。

## Acceptance Criteria

- [ ] Fresh Web UI 用户路径从真实入口输入固定 prompt：`做一个加减乘除的简单网站，使用sqlite存储历史记录`。
- [ ] 每个关键步骤都有对应状态验证记录：入口、workspace、session、角色/权限模式、发送、SSE/runtime、messages、timeline、plan、runtime sessions、files、artifact、preview、DB。
- [ ] Full-control 分支无手动审批阻断且最终产物可运行。
- [ ] Manual allow 分支点击允许后状态变为已允许/已审批，并继续原链路。
- [ ] Manual reject 分支点击拒绝后不执行副作用，不创建最终 artifact/deploy，并等待用户下一次输入或显示明确失败/等待。
- [ ] Web、Mobile/PWA、Desktop/Electron 均有本轮 fresh 证据路径。
- [ ] 生成 `research/execution-reports/bytedance-p0-p1-real-step-uat-2026-06-07.md`，用表格列出每一步 pass/fail/block。

## Out of Scope

- 不开发新产品功能，除非真实 UAT 暴露必须修复的 P0/P1 阻断问题；若需要修复，另行进入实现阶段。
- 不处理最终 Demo 包、3 分钟视频素材、纯 P2。
- 不伪造登录、OAuth、权限或 runtime 成功。

## Technical Notes

- 相关 skill：`agenthub-opencli-uat`。
- 相关规范：`.trellis/spec/cross-layer/real-flow-acceptance.md`、`.trellis/spec/guides/end-to-end-contract-planning.md`。
- 参考 verifier：`apps/web/scripts/verify-strict-single-prompt-product-delivery.ts`。
- 参考 UI tests：`e2e/tests/messaging.spec.ts`、`e2e/tests/mobile/mobile-chat-deliver.spec.ts`。
