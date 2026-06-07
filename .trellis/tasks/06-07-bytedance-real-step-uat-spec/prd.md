# 持久化 Bytedance 全真实 UAT 标准

## Goal

把“Bytedance P0/P1 全真实逐步 UAT”沉淀为可复用、可手动触发、可被后续任务引用的本地 Trellis 规范与项目 skill，避免后续再次用历史 pass、timeline-only、UI-only、API-only 或局部最小实现冒充完整通过。

## Requirements

- 在 `.trellis/spec/cross-layer/real-flow-acceptance.md` 中新增可执行 scenario，包含 `$trellis-update-spec` 要求的 7 段结构。
- 在 `.trellis/spec/guides/end-to-end-contract-planning.md` 中新增短 checklist，指向 code-spec。
- 新增或更新 Bytedance real-step UAT research contract，供 task/tracker/report 引用。
- 新增项目本地 skill，使“Bytedance 全真实验收 / 最终验收 / 不信历史 pass / 按用户视角逐步测”等自然语言能触发。
- 更新 `.trellis/workflow.md`，在无任务和执行态 breadcrumb 中显式提示 Bytedance real-step UAT 触发。
- 修正 `.trellis/config.yaml` 的 journal commit message 为中文，避免治理脚本再因 journal commit message 失败。

## Acceptance Criteria

- [x] 后续任务可通过自然语言触发项目本地 skill。
- [x] 后续 Bytedance/P0/P1/final acceptance 任务可手动或自动读取 real-step UAT spec。
- [x] 任务 jsonl 可引用 spec/contract，并通过 `task.py validate`。
- [x] `git diff --check` 通过。

## Out of Scope

- 本任务只持久化标准和触发入口，不修复当前 Bytedance P0/P1 产品 blocker。
- 不修改 Trellis 上游源码或全局 npm 包。
