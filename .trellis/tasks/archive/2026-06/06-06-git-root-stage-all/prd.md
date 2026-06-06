# Git 面板增加根级全部暂存

## Goal

补齐 VSCode Source Control 的根级暂存入口：在 Git 面板 `未暂存` 分组标题右侧显示一个 `+`，点击后暂存根目录下全部未暂存变更，等价于 `git add .`。

## What I already know

* 用户要求“最上面还有一个加号”，指 Git 面板根目录/未暂存分组层级的全部暂存入口。
* 现有单文件 `+/-` 已在 Git 文件行右侧实现。
* 现有 `POST /api/workspaces/:id/git/stage` 通过 `stageWorkspaceGitPath` 执行 `git add -- <path>`。
* `path: '.'` 会被 workspace path resolver 约束在 workspace root 内，可表达根级 `git add .`。

## Requirements

* `未暂存` 分组标题右侧显示根级 `+` 按钮。
* 点击根级 `+` 调用 `runGitAction('stage', '.')`，暂存全部未暂存变更。
* 无未暂存变更时按钮禁用。
* 保留单文件行右侧 `+/-` 和文件行点击 diff 行为。
* 添加源码契约测试覆盖根级 `+`。

## Acceptance Criteria

* [ ] Git 面板存在 `data-testid="workspace-git-stage-root-button"`。
* [ ] 根级按钮 `aria-label="暂存根目录所有未暂存变更"`。
* [ ] 根级按钮点击执行 `runGitAction('stage', '.')`。
* [ ] 根级按钮在 `unstagedChanges.length === 0` 时 disabled。
* [ ] Web test/type-check/lint 通过。

## Out of Scope

* 不实现根级取消暂存、commit 输入框、全部丢弃。
* 不改变后端 API 路径或 Git discard 审批逻辑。
