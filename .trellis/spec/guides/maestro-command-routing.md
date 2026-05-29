# Maestro Command Routing Guide

> Use this guide when Codex needs to choose a Maestro/Ralph command, generate a Maestro prompt, review Maestro output, or continue a Maestro session.

## Source Of Truth

- Generated command reference: `research/workflow/maestro-command-reference.md`
- Export script: `scripts/export-maestro-command-reference.mjs`
- Raw catalog: `.claude/skills/maestro-help/index/catalog.json`
- Raw command frontmatter: `.claude/commands/*.md`

Regenerate the reference after Maestro command files or catalog files change:

```bash
node scripts/export-maestro-command-reference.mjs
```

## Routing Rules

- Use `argument-hint` from `research/workflow/maestro-command-reference.md` instead of guessing command syntax from memory.
- Prefer a bare command when the command and recent context already express the next step clearly.
- Add a short prompt only when scope boundaries, blockers, deferred items, or completion evidence need to be explicit.
- Use a long copyable prompt only for medium/large contract handoff, risky execute steps, dirty worktrees, governance failures, repeated Maestro misses, unclear product scope, or when the user asks for one.
- Use `/maestro-ralph "<intent>" -y` when the optimal command sequence or lifecycle state is unclear.
- Use `/maestro-ralph status` to inspect the latest Ralph session.
- Use `/maestro-ralph continue` when a Ralph session exists and should resume from current state.
- Use `/maestro-ralph-execute -y` only when a Ralph execution loop already exists and the current step should advance.
- When guiding Ralph through review, decision, or audit steps, include a shell/delegate time budget if the previous step stalled: do not wait indefinitely; after 3-5 minutes without useful output, inspect processes/logs, stop the related background task if needed, and proceed with local evidence or mark BLOCKED.
- Use direct pipeline commands only when the stage is already known:
  - `/maestro-analyze ...`
  - `/maestro-plan ...`
  - `/maestro-execute ...`
  - `/maestro-verify ...`
- For existing plan directories, `/maestro-execute --dir <plan-dir> -y` is valid, but only when Codex intentionally wants the execute stage directly. If Codex needs adaptive gates or wave-by-wave stopping, prefer `/maestro-ralph`.

## AgentHub P0 Rule

For `P0-END-TO-END-PRODUCT-FLOW`, current closeout status is:

```text
P0 closeout verification completed for PLN-20260529-p0-e2e-remaining.
Known non-P0 items: Desktop Electron full E2E needs DESKTOP_APP_PATH; mobile-pwa.spec.ts fixture migration to Auth.js.
```

Do not instruct Maestro/Ralph to continue broad P0 execute unless a new P0 blocker is discovered. Prefer review, milestone audit, or deferred-task planning.

Required references for P0 Maestro guidance:

- `research/workflow/ai-workflow-control.md`
- `research/contracts/P0-END-TO-END-PRODUCT-FLOW.md`
- `research/execution-reports/p0-e2e-remaining-verification-report.md`
- `research/project-tracker.md`
- `.workflow/scratch/20260529-plan-p0-e2e-remaining/verification.json`
- `research/workflow/maestro-command-reference.md`

## Wrong Vs Correct

### Wrong

```text
/maestro-execute -y
```

This may execute more scope than intended and can reopen P0 work after closeout verification.

### Correct

```text
/quality-review P0-END-TO-END-PRODUCT-FLOW --level standard --dimensions architecture,testing,security,maintainability
```

If more context is needed, add a short prompt: "Review only; do not execute. Classify Desktop Electron full E2E and mobile-pwa fixture migration as non-P0 unless a new P0 blocker is found."

## Trellis Task Mapping

Do not mirror every Maestro task into Trellis.

Use this mapping:

| Layer | Unit |
| --- | --- |
| `research/contracts/<TASK-ID>.md` | Product truth and shared contract |
| `.workflow/scratch/*/.task/TASK-*.json` | Maestro execution slices |
| `.trellis/tasks/<orchestration-task>/` | Codex guidance/review/control task |

For long-running Maestro guidance, create one Trellis orchestration task per research contract or milestone. That task should reference the Maestro plan and current released wave in `prd.md`, `task.json.meta`, `implement.jsonl`, and `check.jsonl`.

## Brainstorm Policy

- One-off Maestro command or prompt guidance: no Trellis task and no `trellis-brainstorm`.
- Multi-turn Maestro orchestration with an existing research contract: create one Trellis orchestration task, write a minimal PRD from the contract and plan, curate JSONL context, then start it. Do not run `trellis-brainstorm`.
- Missing contract or unclear product scope: create/update the research contract first; use `trellis-brainstorm` only for unresolved requirements that cannot be inferred from PRD, product design, reference projects, and existing research.
