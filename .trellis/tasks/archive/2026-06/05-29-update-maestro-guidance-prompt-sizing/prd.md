# Update Maestro Guidance Prompt Sizing

## Goal

Record the local Trellis/Maestro guidance rule that Codex should not default to long copyable Maestro prompts.

## Requirements

- Prefer a direct `/maestro-*`, `/quality-*`, or `/manage-*` command when the command and recent context are sufficient.
- Add a short prompt only when the command needs extra scope, blocker, deferred-item, or completion-evidence constraints.
- Use a long prompt only for complex/high-risk handoffs, dirty worktrees, governance failures, repeated Maestro misses, unclear scope, or explicit user request.
- Keep governance rules intact: contracts, execution reports, tracker updates, precise commits, and governance gate remain required when applicable.

## Files

- `research/workflow/maestro-guidance-playbook.md`
- `.trellis/spec/guides/maestro-command-routing.md`
- `.trellis/workflow.md`
- `.agents/skills/trellis-start/SKILL.md`
