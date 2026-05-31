# 修复桌面端诊断按钮和本地输入框语义

## Goal

修复 Desktop 本地 Agent 会话里的两个真实可用性问题：`诊断`按钮点击无效，以及输入框把用户文本当任意 shell 命令执行，导致用户不知道该输入什么，失败时只看到 `ENOENT` / 退出码。

## What I Already Know

- 用户反馈：诊断按钮点击无效。
- 用户反馈：桌面端输入框输入内容并发送后只显示退出码或 `ENOENT`，用户无法理解这个输入框的用途。
- 代码事实：`DesktopAgentSession.tsx` 的 `诊断`按钮只有 `title` 和 `disabled`，没有 `onClick`。
- 代码事实：`DesktopAgentSession.tsx` 当前把输入框内容直接传给 `runtime.execute(command, cwd)`。
- 代码事实：`LocalRuntimeAdapter.execute()` 当前使用 `child_process.exec(command)` 执行任意 shell 字符串，语义更像开发调试命令行，不像产品里的 Agent 对话输入。
- 关联合同：`research/contracts/LOCAL-DESKTOP-OPERABILITY-001.md` 要求 Desktop doctor 真实可用，控制按钮不能是无效果死按钮。

## Requirements

- 诊断按钮必须有真实行为：触发 Runtime 检测/doctor，并把 Claude Code / Codex 的检测结果写入活动列表。
- 本地会话输入框必须有清晰语义：输入的是给当前选中 Runtime 的一次性提示词，不是任意 shell 命令。
- 发送时必须根据 selectedAgent 选择真实 Runtime：
  - Codex：使用 `codex exec <prompt>`。
  - Claude Code：使用 `claude --print <prompt>`。
- 如果 Runtime 未安装、未认证、不可启动或 Electron runtime 桥接不可用，发送前直接展示中文阻塞原因，不再让用户只看到低层 `ENOENT`。
- UI 文案必须避免“输入指令...”这种误导；改成“输入给 Codex/Claude Code 的消息...”。
- 不在本任务中实现长连接、多轮 native session resume/continue；一次性执行只作为 P0 本地 CLI 可用性验证和轻量对话入口。

## Acceptance Criteria

- [ ] 点击 `诊断` 会调用 `runtime.detect()`，并在活动列表显示每个 Runtime 的安装/认证/可启动状态。
- [ ] 输入框 placeholder 明确说明输入内容是发给当前 Agent 的消息。
- [ ] 选中 Codex 后发送 `hello` 时，renderer 调用 runtime API 的结构能表达 runtime 类型和 prompt，不再把 `hello` 当 shell command。
- [ ] 选中 Claude Code 后发送 `hello` 时，使用 Claude Code 一次性 print 模式。
- [ ] Runtime 不可用时，活动列表展示中文错误，不出现裸 `ENOENT` 作为唯一信息。
- [ ] Desktop 单测覆盖诊断按钮、Codex 发送、Claude Code 发送、不可用错误提示。

## Out of Scope

- 不实现 provider-specific native session 恢复。
- 不实现 Web 端到 Desktop 的完整流式 Runtime 会话。
- 不实现任意 shell 命令执行器；产品主路径不应暴露任意 shell 输入。

## Technical Notes

- 主要文件：
  - `apps/desktop/src/renderer/components/shell/DesktopAgentSession.tsx`
  - `apps/desktop/src/main/runtime/local-adapter.ts`
  - `apps/desktop/src/main/runtime/ipc.ts`
  - `apps/desktop/src/preload/index.ts`
  - `apps/desktop/src/renderer/utils/electron-api.ts`
  - `apps/desktop/__tests__/desktop-agent-session.test.tsx`
- 相关规范：
  - `.trellis/spec/cross-layer/runtime-credential-boundary.md`
  - `.trellis/spec/frontend/index.md`
  - `research/contracts/LOCAL-DESKTOP-OPERABILITY-001.md`
