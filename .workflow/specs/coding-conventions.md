---
title: "Coding Conventions"
readMode: required
priority: high
category: coding
keywords:
  - style
  - naming
  - import
  - pattern
  - convention
  - formatting
---

# Coding Conventions

## Formatting

## Naming

## Imports

## Patterns

## Entries



<spec-entry category="coding" keywords="wave,跟进,tracker,execution-report,commit" date="2026-05-26">

### 执行跟进同步规则

每个 wave 完成后必须同步更新 research/project-tracker.md（对应任务状态、下一步动作）和 research/execution-reports/*.md（wave 完成记录、验收结果）。没有公开跟进记录，不允许标记任务完成。验证通过后自动 git add 并 git commit，commit message 必须使用中文。

</spec-entry>

<spec-entry category="coding" keywords="ui,design-system,组件,视觉" date="2026-05-26">

### UI 修改必须遵循设计系统

所有 UI 修改必须遵循 research/product/ui-design-system.md 中定义的三端 UI 设计系统、组件契约和视觉 E2E 门禁。不允许引入未在设计系统中定义的组件模式或违反视觉母版契约。

</spec-entry>

<spec-entry category="coding" keywords="git,commit,中文,提交" date="2026-05-26">

### Git commit 规范

验证通过后自动 git add 变更文件并 git commit。commit message 必须使用中文，格式为「类型: 简短描述」（类型：feat/fix/refactor/docs/test/chore）。不允许英文 commit message。

</spec-entry>