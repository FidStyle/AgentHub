<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->

# AgentHub Project Workflow

Before guiding or executing non-trivial AgentHub work, read `research/index.md` and `research/ai-workflow-control.md`.

Project workflow rule:

- `research/` is the shared contract layer and public project ledger.
- `research/contracts/<TASK-ID>.md` is the required interface between Trellis and Maestro/Ralph for medium or large tasks.
- `.trellis/` owns Codex/Trellis task context and engineering specs.
- `.workflow/` owns Maestro/Ralph execution state, roadmap, scratch plans, and status files.
- Do not treat `.workflow/.maestro/*/status.json` as project completion.
- Do not use mock runtime data to satisfy MVP product flows that require real database/API/session behavior.
- Codex is the workflow controller and final technical reviewer; Maestro/Ralph is the large-scope execution engine; Trellis is the implementation-spec and task-context system.
