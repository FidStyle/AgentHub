# 代码事实审计 P0 进度

## Goal

基于当前代码、测试文件和实际命令输出重新审计 P0 完成情况，不信任 `research/` 中关于进度和完成状态的既有结论。若发现进度台账与代码事实不一致，只更新进度/报告类文档并单独提交校正原因。

## What I already know

- 用户明确要求不要相信 `research` 里的进度文档。
- 旧报告只能作为待核对线索，不能作为完成证据。
- 当前工作区已有多处未提交业务/UI 改动，本任务不得回滚或混入这些改动。

## Requirements

- 以源码、测试源码、可运行脚本输出为主要证据。
- `research/` 中的 PRD、设计系统、Desktop P0 契约可作为验收标准；进度表、执行报告、PASS 报告只能作为待核对对象。
- 检查 Web、Desktop、Mobile/PWA、视觉 E2E、敏感字段边界、关键入口点击语义。
- 如进度台账不实，修正公开进度记录，写明基于代码事实的原因。
- 若需要提交，只提交本次审计产生的进度/报告文档和本任务元数据，不包含既有业务代码改动。

## Acceptance Criteria

- [ ] 输出代码事实审计结论，区分已达标、未达标、无法确认。
- [ ] 至少运行静态检查或测试发现命令，记录是否通过。
- [ ] 如修改进度文档，改动内容反映实际证据。
- [ ] 形成独立 git commit，commit message 说明为 P0 进度校正。

## Out of Scope

- 不修复业务代码。
- 不把旧执行报告的 PASS 结论直接当作验收结果。
- 不提交用户已有业务/UI WIP。

## Technical Notes

- 审计对象优先包括 `apps/web`、`apps/desktop`、`apps/mobile`、`e2e/tests`、`packages/shared`。
- 进度校正优先落到 `research/project-tracker.md`；bug/regression/未完成项进入 `research/regression-ledger.md`；只有阶段级审计需要新增或更新 `research/execution-reports/*`。
