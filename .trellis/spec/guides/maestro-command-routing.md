# Maestro Command Routing Guide

> Use this guide when Codex needs to choose a Maestro/Ralph command, generate a Maestro prompt, review Maestro output, or continue a Maestro session.

## Source Of Truth

- Generated command reference: `research/maestro-command-reference.md`
- Export script: `scripts/export-maestro-command-reference.mjs`
- Raw catalog: `.claude/skills/maestro-help/index/catalog.json`
- Raw command frontmatter: `.claude/commands/*.md`

Regenerate the reference after Maestro command files or catalog files change:

```bash
node scripts/export-maestro-command-reference.mjs
```

## Routing Rules

- Use `argument-hint` from `research/maestro-command-reference.md` instead of guessing command syntax from memory.
- Use `/maestro-ralph "<intent>" -y` when the optimal command sequence or lifecycle state is unclear.
- Use `/maestro-ralph status` to inspect the latest Ralph session.
- Use `/maestro-ralph continue` when a Ralph session exists and should resume from current state.
- Use `/maestro-ralph-execute -y` only when a Ralph execution loop already exists and the current step should advance.
- Use direct pipeline commands only when the stage is already known:
  - `/maestro-analyze ...`
  - `/maestro-plan ...`
  - `/maestro-execute ...`
  - `/maestro-verify ...`
- For existing plan directories, `/maestro-execute --dir <plan-dir> -y` is valid, but only when Codex intentionally wants the execute stage directly. If Codex needs adaptive gates or wave-by-wave stopping, prefer `/maestro-ralph`.

## AgentHub P0 Rule

For `P0-END-TO-END-PRODUCT-FLOW`, current plan status is:

```text
PLAN_ANTI_PATTERN_REVIEW: PASS_FOR_WAVE_1_EXECUTION
```

Only Wave 1 / TASK-001 is currently released for execution. Do not instruct Maestro/Ralph to execute TASK-002 through TASK-006 until Codex reviews Wave 1 evidence.

Required references for P0 Maestro guidance:

- `research/ai-workflow-control.md`
- `research/contracts/P0-END-TO-END-PRODUCT-FLOW.md`
- `research/execution-reports/p0-end-to-end-product-flow-plan-report.md`
- `research/project-tracker.md`
- `.workflow/scratch/20260528-plan-p0-e2e-fix/.task/TASK-001.json`
- `research/maestro-command-reference.md`

## Wrong Vs Correct

### Wrong

```text
/maestro-execute -y
```

This may execute more scope than intended and does not encode the Wave 1 stop condition.

### Correct

```text
/maestro-ralph "Execute only Wave 1 / TASK-001 for P0-END-TO-END-PRODUCT-FLOW ..." -y
```

The intent must explicitly say to stop after Wave 1 for Codex review.
