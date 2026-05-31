# 修复桌面端默认本地工作目录

## Goal

修复 Desktop 本地 Runtime 一次性消息发送时默认工作目录不存在的问题。默认不再指向假路径 `~/Projects/agenthub`，而是使用 AgentHub 自有目录 `~/.agenthub/workspaces/default`，并在执行前自动创建缺失目录。

## Requirements

- Desktop store 的默认 workspace 目录改为 `~/.agenthub/workspaces/default`。
- Runtime 执行前如果工作目录不存在，应自动创建目录，而不是直接返回“工作目录不存在”。
- 目录创建失败时才返回明确中文错误。
- 保持 prompt 执行语义不变：Codex 走 `codex exec`，Claude Code 走 `claude --print`。
- 增加/更新测试覆盖自动创建目录和默认目录文案。

## Acceptance Criteria

- [ ] 默认工作目录不再是 `~/Projects/agenthub`。
- [ ] 缺失的默认工作目录会自动创建。
- [ ] Desktop 单测通过。
- [ ] Desktop type-check/build 通过。

## Out of Scope

- 不实现用户自定义工作目录管理 UI。
- 不实现多 workspace 文件浏览器。
