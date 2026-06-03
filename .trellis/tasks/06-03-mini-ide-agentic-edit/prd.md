# Mini IDE agentic edit workbench

## Goal

在现有 Web Workspace 右栏中交付一个 Trae/Cursor 式小型 IDE/workbench MVP：用户打开云端工作区文件，选中一段内容作为上下文，生成可审阅的修改草案，先看 patch/diff，再选择应用或拒绝；应用后进入真实 Git 变更流，并可查看 commit history。

## What I already know

* 当前 worktree 是 `feature/mini-ide-agentic-edit`，只允许修改本 worktree。
* 相关共享合同是 `research/contracts/ORCHESTRATOR-IM-MARKDOWN-GIT-DIFF-2026-06-03.md`，其中已经要求真实 Git status/diff/action 面板。
* 现有 Web 右栏组件集中在 `apps/web/components/workspace/ArtifactPanel.tsx`，Tab 为 `角色 / 文件 / 变更 / 产物`。
* 文件 Tab 已支持云端工作区文件树、读取预览、上传、重命名、删除、存为产物。
* 变更 Tab 已支持真实 Git status、per-file diff、stage、unstage、discard approval、保存 diff 为产物。
* 底层 helper `apps/web/lib/workspace/cloud-workspace-fs.ts` 已有 `writeWorkspaceFile`、`readWorkspaceGitStatus`、`readWorkspaceGitDiff`、stage/unstage/discard 等能力。
* 当前没有文件保存 API、patch draft API、patch apply API、Git commit history API。

## Assumptions

* MVP 不引入 Monaco 等完整 IDE 依赖；使用轻量 textarea/code preview 即可完成选区上下文和 patch 审阅闭环。
* “agentic edit” 在本任务中先实现为可审阅的编辑草案工作流：选区和指令生成本地草案/diff，用户 Apply 后才写文件。完整 LLM 自动改写、多文件 edit plan 和 runtime streaming 后续另立任务。
* 只覆盖云端工作区文件；本地 Desktop Connector 文件编辑仍按现有边界留到后续。
* Apply/Reject 是 draft 级行为：Reject 不写文件；Apply 调用真实 API 写入工作区文件并刷新文件树/Git status。

## Requirements

* 文件 Tab 对 text/code/markdown 文件展示轻量编辑器，允许用户选择文本范围。
* 用户可输入编辑指令，并从当前选区生成修改草案；草案必须显示选区上下文、改动摘要和 diff。
* 用户点击 `应用修改` 后通过真实 API 写入云端工作区文件，并触发 `workspace-files:changed` 让变更 Tab 刷新。
* 用户点击 `拒绝` 后草案被清空，不修改文件。
* 文件保存和 patch apply 必须复用 workspace path boundary，拒绝越界路径。
* 变更 Tab 增加 Git commit history，展示最近提交 hash、message、author/date。
* Commit history 必须来自真实 `git log`，不能从 mock 数据构造。
* 用户可从同一右栏完成：打开文件 -> 选区 -> 生成 draft -> diff 审阅 -> apply/reject -> 查看 Git 变更和历史。

## Acceptance Criteria

* [ ] 打开支持预览的文本/代码/Markdown 文件后，用户能在编辑区域选择文本并看到选区摘要。
* [ ] 输入指令并生成 draft 后，界面展示 unified diff；原文件不立即改变。
* [ ] Reject draft 后再次读取文件内容不变。
* [ ] Apply draft 后文件内容通过真实文件 API 更新，Git status 出现对应变更。
* [ ] 变更 Tab 可展示最近 Git commit history；无提交时显示中文空状态。
* [ ] Helper 单元测试覆盖 patch draft/apply 和 git history 的核心行为。
* [ ] 相关 lint/type-check/test 通过。

## Definition of Done

* 按 `.trellis/spec/frontend`、`.trellis/spec/backend`、`.trellis/spec/cross-layer` 相关规范实现。
* 不使用 mock runtime data 伪造主链路。
* 不引入大范围产品扩题，例如完整 Monaco、多文件 refactor、自动 commit 或真实 LLM patch agent。
* 运行 `trellis-check`，必要时 `trellis-update-spec`，最后准备提交。

## Out of Scope

* 完整 Monaco/VS Code 级编辑器。
* 自动调用 Claude/Codex 生成多文件 patch。
* Desktop 本地文件写入。
* 自动 commit、push、branch 管理。
* 三端 Mobile diff 编辑体验。

## Technical Notes

* 相关文件：
  * `apps/web/components/workspace/ArtifactPanel.tsx`
  * `apps/web/lib/workspace/cloud-workspace-fs.ts`
  * `apps/web/app/api/workspaces/[id]/files/read/route.ts`
  * `apps/web/app/api/workspaces/[id]/git/status/route.ts`
  * `apps/web/app/api/workspaces/[id]/git/diff/route.ts`
  * `apps/web/__tests__/workspace-files-artifacts.test.ts`
* 相关合同：
  * `research/contracts/ORCHESTRATOR-IM-MARKDOWN-GIT-DIFF-2026-06-03.md`
* 相关规范：
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/backend/index.md`
  * `.trellis/spec/cross-layer/index.md`
  * `.trellis/spec/guides/index.md`
