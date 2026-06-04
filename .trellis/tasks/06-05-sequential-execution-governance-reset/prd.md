# 单分支顺序执行治理重置

## Goal

把 AgentHub 后续执行从多 worktree/lane 并行切回当前会话、当前分支顺序执行，建立可持续维护的总进度表，并把失败即停、三端验收、OpenCLI 优先和禁止假绿的可执行规则沉淀到 Trellis code-spec。

## What I Already Know

- 用户要求不再用 worktree 并行开发，统一回到当前会话、当前分支顺序执行。
- 项目需要新增并维护 `research/sequential-execution-progress.md`，记录功能点、Trellis task、状态、优先级、验证方式、证据路径、阻塞项和下一步。
- 功能点默认先建一个 Trellis task；遇到跨子系统、OpenCLI UAT 失败、P0/P1 风险变大或需要单独验证时，自动拆成多个 task。
- 每次只执行一个 active task；当前任务失败则停在该功能内拆修复/验证子任务，不能跳过继续。
- 每个 task 完成必须单独验证、commit、关闭；下一 task 开始前 `git status --short` 必须 clean。
- 用户追加要求：所有任务与验收标准都需要三端验收通过；OpenCLI 能够测 Web、Mobile 浏览器/PWA 和 Electron。
- 最高验收事实源仍是 `bytedance_init_prd.md` 和 `bytedance_init_video_txt.txt`。

## Repo Facts Discovered

- 当前分支是 `AgentHub_new_claude_test`，工作区开始时 clean。
- 当前 Trellis active pointer 已指向 `.trellis/tasks/06-05-sequential-execution-governance-reset`。
- 旧并行任务仍在 `.trellis/tasks/` 下显示为 `in_progress` 或 `planning`，包括：
  - `06-03-mini-ide-agentic-edit`
  - `06-03-oss-component-migration-workbench-upgrade`
  - `06-03-rich-doc-ppt-artifacts`
  - `06-03-role-runtime-workspace-permissions`
  - `06-04-message-actions-topbar`
  - `06-04-worktree-e2e-governance`
- 旧 `ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03` 合同仍包含 worktree lane 和 `3106` 端口建议；后续顺序执行表需要覆盖未来执行方式。
- `.trellis/spec/cross-layer/real-flow-acceptance.md` 已有 OpenCLI real browser acceptance 场景，但需要升级为三端默认验收门禁。
- `.trellis/spec/cross-layer/parallel-worktree-testing.md` 仍是历史并行 worktree 规范；需要补充当前顺序执行优先级，避免未来误用旧 lane 计划。

## Requirements

- 新增 `research/sequential-execution-progress.md` 作为顺序执行总表。
- 总表必须包含初始队列：
  1. `06-05-sequential-execution-governance-reset`
  2. `06-05-sync-role-runtime-opencli-failure-evidence`
  3. `06-05-fix-role-runtime-cwd-context-isolation`
  4. `06-05-fix-architect-durable-dispatch`
  5. `06-05-fix-runtime-permission-broker`
  6. `06-05-opencli-role-runtime-uat`
  7. Bytedance demo 后续任务队列
- 清理 stale active task 指针：当前指针只保留本 task；旧 worktree/lane task 不再视为可继续并行执行。
- 收口旧 worktree/lane 任务状态：在 task metadata 或总表中明确标记为被顺序队列接管，不允许继续以旧 worktree 验收口径推进。
- 把治理规则写入 `.trellis/spec`：
  - 当前分支顺序执行。
  - 当前任务失败即停。
  - 三端验收默认必需：Web、Mobile 浏览器/PWA、Desktop/Electron。
  - OpenCLI 是 Web/Mobile 浏览器/Electron 真实 UI 验收的首选工具；Playwright/unit/type-check 只能补充，不能替代 OpenCLI UAT。
  - 禁止 fake/script runtime、mock 主链路、局部测试假绿。
  - 任务完成前必须更新总表，写证据路径、commit、关闭状态。
- 同步 `research/index.md` 与 `research/project-tracker.md`，让顺序执行总表成为公开入口。

## Acceptance Criteria

- [ ] `research/sequential-execution-progress.md` 存在，包含规则、队列、当前任务状态、旧 lane 收口记录和更新协议。
- [ ] `.trellis/spec/cross-layer/real-flow-acceptance.md` 包含三端验收与 OpenCLI Web/Mobile/Electron 验收契约。
- [ ] `.trellis/spec/cross-layer/parallel-worktree-testing.md` 明确历史并行 worktree 规则被当前顺序执行模式覆盖，除非用户显式恢复并行。
- [ ] 旧 `in_progress/planning` worktree/lane task 在 `task.json` notes/meta 中标记为 sequential queue 接管或 superseded，不再作为并行 active task。
- [ ] `research/index.md` 和 `research/project-tracker.md` 有顺序执行总表入口。
- [ ] `git status --short`、Trellis 当前任务、文档内容检查通过。

## Out of Scope

- 不修 role runtime 业务代码。
- 不跑 role runtime OpenCLI UAT；这属于后续 `06-05-opencli-role-runtime-uat`。
- 不删除旧 worktree 目录。
- 不把旧 worktree/lane 的业务实现结果直接宣称通过。

## Technical Notes

- 本任务是治理和文档/spec 状态重置，不涉及 app runtime 代码。
- 后续每个功能点如发现失败，自动在同一功能下拆修复/验证子任务并回写总表。
