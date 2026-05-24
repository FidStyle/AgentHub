# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

- 本地 Claude Code / Codex 的 Role Agent 或 Runtime 绑定 UI 不得渲染 API Key、Base URL、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 等默认输入框。P0 只展示检测、绑定、诊断和本机登录/安装引导。

---

## Required Patterns

- All user-visible frontend copy must use Simplified Chinese across Web, Desktop, and Mobile/PWA.
- Terminology for shared concepts must stay consistent across the three surfaces: 工作区、会话、审批、产物、预览、智能体、桌面连接器。
- Technical product names may remain in English only when they identify a specific technology or command, such as Vite, Electron, PWA, Codex, Claude Code, Node, or `corepack pnpm`.
- 本地 Runtime 凭证边界必须遵守 `.trellis/spec/cross-layer/runtime-credential-boundary.md`：本地 CLI 只检测原生认证状态，不托管密钥。

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)
