# Codex Session Transcript Tracking Guide

> 用于在需要追溯对话上下文时，把 Codex session 导出成 Markdown，避免只依赖当前聊天窗口记忆。

## When to Use

使用本 guide 的触发点：

- 用户要求“跟踪我们的对话”“导出这轮会话”“回看刚才上下文”。
- 当前工作经历了多窗口、多 worktree 或长时间总控调度，需要保留审计材料。
- 上下文压缩后需要恢复之前的决策、prompt、验收标准或用户原话。
- 需要把某个 Codex session 的对话交给其他 lane、合同、报告或 review 使用。

## Required Input

如果当前上下文里没有 session id，直接向用户索取：

```text
请提供这轮 Codex session id，我会用它导出对话上下文。
```

session id 示例：

```text
019e8d3d-9f6b-7c01-909a-fcd12ea23cc5
```

## Command

导出命令：

```bash
codex-session-to-markdown --with-context <session-id> > <output>.md
```

示例：

```bash
codex-session-to-markdown --with-context 019e8d3d-9f6b-7c01-909a-fcd12ea23cc5 > 2.md
```

## Usage Contract

- 只有在用户提供或确认 session id 后才导出。
- 默认不要把导出文件写进根目录临时命名文件；除非用户明确指定，优先使用可说明用途的路径，例如 `.workflow/session-transcripts/<session-id>.md` 或当前任务目录下的 `research/session-transcript.md`。
- 导出后先总结关键决策、未完成事项、已执行命令和用户最新约束，再继续工作。
- 如果导出内容要进入合同、spec、tracker 或报告，只引用必要结论；不要整段复制长聊天记录。
- 如果命令不可用或 session id 无效，说明失败原因，并让用户重新提供 session id 或可访问的导出文件。

## Wrong vs Correct

### Wrong

```text
我记得大概是这样，直接继续做。
```

问题：长会话或压缩后容易丢失用户约束，尤其是总控、多 worktree、权限和验收规则。

### Correct

```bash
codex-session-to-markdown --with-context <session-id> > .workflow/session-transcripts/<session-id>.md
```

然后输出：

```text
我已导出并核对 session。关键约束是：...
接下来按这些约束继续。
```
