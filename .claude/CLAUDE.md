<!-- maestro:start section="core" -->
# Maestro

Workflow orchestration CLI with MCP endpoint support and extensible architecture.

- **Coding Philosophy**: @~/.maestro/workflows/coding-philosophy.md

## Delegate & CLI

- **Delegate Usage**: @~/.maestro/workflows/delegate-usage.md
- **CLI Endpoints Config**: @~/.maestro/cli-tools.json

**Strictly follow the cli-tools.json configuration**

Available CLI endpoints are dynamically defined by the config file

## Code Diagnostics

- **Prefer `mcp__ide__getDiagnostics`** for code error checking over shell-based TypeScript compilation

## Knowledge System

### Search — Query Before Acting

**Before planning or implementing any task, search wiki and spec first** — the knowledge base contains reusable methods, tools, and hard-won experience. Load the right knowledge at the right time: search before you plan, load relevant entries before you implement, and revisit when you hit unfamiliar territory mid-task.

When tackling unfamiliar domains or cross-cutting concerns, search existing knowledge first:
- `maestro spec load --category <cat>` — load rules by category (coding/arch/debug/test/review/learning)
- `maestro spec load --keyword <kw>` — cross-category keyword match
- `maestro wiki search "<query>"` — full-text search across all knowhow
- `maestro wiki list --category <cat>` → `maestro wiki load <id>` — browse then load full detail

### Record — Capture Knowledge

When execution surfaces non-obvious knowledge (decisions, root causes, pitfalls, patterns), persist it:

- **Spec entry** (short rule/constraint) → `/spec-add <category> "title" "content" --keywords kw1,kw2`
- **Knowhow document** (detailed recipe/template/decision/reference) → `/manage-knowhow-capture`

Category routing: decisions→`arch`, patterns→`coding`, pitfalls→`debug`/`learning`, rules→`review`, test strategy→`test`.
<!-- maestro:end section="core" -->

<!-- maestro:start section="chinese" -->
# 中文回复准则

## 核心原则

- 所有回复使用简体中文
- 技术术语保留英文，首次出现可添加中文解释
- 代码变量名保持英文，注释使用中文

## 格式规范

- 中英文/数字间加空格：`使用 TypeScript 开发`、`共 3 个文件`
- 使用中文标点：，。！？：；
- 代码/命令用反引号：`npm install`

## Git Commit

- 使用中文提交信息
- 格式：`类型: 简短描述`
- 类型：feat/fix/refactor/docs/test/chore

## 保持英文

- 代码文件内容
- 错误信息和日志
- 文件路径和命令
<!-- maestro:end section="chinese" -->
