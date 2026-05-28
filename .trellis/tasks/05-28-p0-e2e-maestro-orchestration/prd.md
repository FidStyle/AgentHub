# P0 End-to-End Maestro Orchestration

## Goal

Use Trellis as the Codex control task for guiding Maestro/Ralph through `P0-END-TO-END-PRODUCT-FLOW`, without mirroring every Maestro task into Trellis.

This Trellis task exists to coordinate, review, and gate Maestro execution. It does not replace the research contract and does not duplicate `.workflow/scratch/*/.task/TASK-001..006.json`.

## Binding

- Research contract: `research/contracts/P0-END-TO-END-PRODUCT-FLOW.md`
- Public tracker: `research/project-tracker.md`
- Maestro plan: `.workflow/scratch/20260528-plan-p0-e2e-fix/plan.json`
- Current released Maestro scope: Wave 1 / `TASK-001` only
- Plan review status: `PLAN_ANTI_PATTERN_REVIEW: PASS_FOR_WAVE_1_EXECUTION`

## Operating Model

| Layer | Role |
| --- | --- |
| `research/` | Product truth, contracts, public tracker, execution reports |
| `.workflow/` | Maestro/Ralph execution state and task slices |
| `.trellis/tasks/05-28-p0-e2e-maestro-orchestration/` | Codex guidance/review task for the current orchestration session |

Trellis should not create one task per Maestro `TASK-001..006`. Maestro owns those execution slices. Trellis owns the Codex control loop: command selection, prompt construction, evidence review, and wave release decisions.

## Requirements

- Generate Maestro/Ralph commands using `research/maestro-command-reference.md` and `.trellis/spec/guides/maestro-command-routing.md`.
- For P0, release only Wave 1 / `TASK-001` until Codex reviews evidence.
- Require Maestro/Ralph to read the research contract, plan report, project tracker, and the relevant `.workflow/scratch` task JSON.
- Require dirty baseline capture and precise commits for each Maestro wave.
- Treat `.workflow/.maestro/*/status.json` as execution state only, not product completion.
- After each Maestro wave, Codex must review:
  - changed files
  - latest commit
  - `research/project-tracker.md`
  - execution report updates
  - real command/test evidence
  - whether the next wave can be released

## Brainstorm Policy

Do not run `trellis-brainstorm` for this task. The product boundary is already defined by `research/contracts/P0-END-TO-END-PRODUCT-FLOW.md` and the Rev 3 plan.

Future Maestro/Ralph guidance tasks follow this rule:

- If the user asks a one-off command/prompt question, answer directly using `research/maestro-command-reference.md`; no Trellis task and no brainstorm.
- If guidance will span multiple turns or multiple Maestro waves, create one Trellis orchestration task bound to the research contract; no per-Maestro-task mirroring.
- If no research contract exists or product scope is unclear, create/update the contract first and use `trellis-brainstorm` only for unresolved product requirements.

## Acceptance Criteria

- Old stale active task is archived.
- This task is the active Trellis task for P0 orchestration.
- `implement.jsonl` and `check.jsonl` contain the research/spec context needed to guide and review Maestro.
- Maestro is only instructed to execute Wave 1 / `TASK-001`.
- After Wave 1, Codex produces a review decision before Wave 2 is released.

## Out Of Scope

- Directly implementing Web/Desktop/Mobile code in this task.
- Running all Maestro waves at once.
- Treating Maestro `status.json completed` as product completion.
- Creating separate Trellis tasks for Maestro `TASK-001..006`.
