# Git 面板按 VSCode 暂存交互调整

## Goal

把右侧工作台 Git 面板调整为类似 VSCode Source Control 的交互：文件行本身用于查看 diff，未暂存文件右侧 `+` 一键暂存，已暂存文件右侧 `-` 一键取消暂存。不要让用户必须先打开 diff 再到底部点暂存/取消暂存。

## What I already know

* 用户指出 Git 查看 diff / 暂存不应该是现在这种操作方式，应该学习 VSCode。
* 当前 `ArtifactPanel.tsx` 的 `GitChangeTreeView`：点击文件行打开 diff；stage/unstage 按钮在右侧 diff viewer 的动作区。
* API 已存在：`POST /api/workspaces/:id/git/stage`、`POST /api/workspaces/:id/git/unstage`、`GET /git/diff`。
* 现有规范已经要求 Git tree first、点击文件后显示 diff，但还没有明确行内 `+/-` 暂存按钮。

## Requirements

* 未暂存文件行右侧显示 `+` 按钮，点击直接调用 stage。
* 已暂存文件行右侧显示 `-` 按钮，点击直接调用 unstage。
* 点击文件名/文件行仍打开对应 diff。
* `+/-` 按钮必须阻止事件冒泡，不能同时触发打开 diff。
* 保留状态 badge、目录展开、diff viewer、底部现有动作作为补充入口。
* 行结构不能嵌套 button，避免非法 HTML 和点击冲突。

## Acceptance Criteria

* [ ] `GitChangeTreeView` 接收行内 action handler，未暂存文件渲染 `workspace-git-stage-button`。
* [ ] 已暂存文件渲染 `workspace-git-unstage-button`。
* [ ] 文件行点击区域渲染为独立按钮并只负责打开 diff。
* [ ] `+/-` 按钮有中文 aria-label/title，点击时 stopPropagation。
* [ ] 源码契约测试覆盖 VSCode-like 行内加减按钮和 stopPropagation。
* [ ] Web test/type-check/lint 通过。

## Out of Scope

* 不实现 commit 输入框、全部暂存、全部取消暂存。
* 不改变 git discard 审批逻辑。
* 不修改后端 git API 语义。

## Technical Notes

* 主要文件：`apps/web/components/workspace/ArtifactPanel.tsx`。
* 测试文件：`apps/web/__tests__/message-markdown.test.ts`。
* 规范文件可补充 `.trellis/spec/frontend/component-guidelines.md` 的 Git progressive disclosure。
