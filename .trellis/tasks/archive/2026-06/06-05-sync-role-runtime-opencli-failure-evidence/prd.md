# 同步 role runtime OpenCLI 失败证据

## Goal

把旧 `06-03-role-runtime-workspace-permissions` lane 的验收事实同步到当前分支和顺序执行总表，明确哪些证据已经存在、哪些真实 OpenCLI / 三端 UAT 没有跑，避免后续把旧 worktree/lane 的合同测试误当成 Bytedance 产品主链路通过。

## What I Already Know

- 当前分支是 `AgentHub_new_claude_test`，开始时 `git status --short` clean。
- 顺序执行总表要求本任务只同步 `role-runtime-opencli-uat` 失败事实、证据路径和进度状态，不修业务代码。
- 旧任务 `.trellis/tasks/06-03-role-runtime-workspace-permissions/research/acceptance-report.md` 记录了 2026-06-03 的合同测试证据。
- 旧报告明确写明：
  - lane port 是 `3106`。
  - 最终 server-backed E2E baseUrl 规则是 `http://127.0.0.1:3106`。
  - 实际本轮没有启动 dev server。
  - 实际本轮没有使用 baseUrl。
  - 没有使用默认端口或自动跳端口作为证据。
- 旧报告包含 shared/domain/Desktop 层的 cwd、context isolation、role dispatch、permission broker 合同测试证据，但没有 Web/Mobile/Electron OpenCLI 真实 UI 证据。

## Requirements

- 新增 execution report，记录旧 lane 事实和当前验收结论。
- 更新 `research/sequential-execution-progress.md`：
  - 当前任务指针切到本任务。
  - 第 2 项状态推进并写入证据路径。
  - 后续第 3 项 `06-05-fix-role-runtime-cwd-context-isolation` 仍保持 queued，不因为旧合同测试存在而被跳过。
- 更新 `research/project-tracker.md`，登记本 P0 证据同步任务，明确 OpenCLI 三端 UAT 仍未通过。
- 不修改业务代码，不修 runtime、orchestrator、permission broker。
- 不把旧 lane 的合同测试或单测报告写成产品完成。
- 保留后续队列拆分：
  - cwd/context 隔离修复。
  - 架构师 durable dispatch 修复。
  - runtime permission broker 修复。
  - 固定样本三端 OpenCLI UAT。

## Acceptance Criteria

- [ ] `research/execution-reports/role-runtime-opencli-failure-evidence-2026-06-05.md` 存在，列明旧报告路径、测试命令、已有证据和未覆盖范围。
- [ ] Report 的三端矩阵把 Web、Mobile/PWA、Desktop/Electron 标为 `not-run` 或 `not-accepted`，不得写 passed。
- [ ] `research/sequential-execution-progress.md` 第 2 项有具体证据路径，状态不再是纯 `queued`。
- [ ] `research/project-tracker.md` 有本任务公开记录。
- [ ] `git diff --check` 通过。
- [ ] `git status --short` 能说明本任务只改文档/Trellis 任务文件。

## Out of Scope

- 不启动 dev server。
- 不运行 OpenCLI UAT。
- 不修 `cwd` 绑定、上下文隔离、架构师派发或权限 broker。
- 不创建 fake runtime 或 mock 数据来补验收。

## Technical Notes

- 本任务是顺序队列中的证据同步任务，不是产品修复任务。
- 旧 lane 事实源：`.trellis/tasks/06-03-role-runtime-workspace-permissions/research/acceptance-report.md`。
- 共享合同：`research/contracts/ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03.md`。
- 验收规范：`.trellis/spec/cross-layer/real-flow-acceptance.md` 与 `.trellis/spec/backend/runtime-workspace-contract.md`。
