# Bytedance P0/P1 final completion gate

## Goal

Complete and strictly verify all remaining Bytedance P0/P1 product flows for AgentHub. This task is a final completion gate: it must identify every P0/P1 gap, repair the implementation where needed, and produce fresh evidence from real user flows before any completion claim.

## Scope

- Included: P0/P1 IM-first orchestration, permissions, workbench, artifacts, role runtime handoffs, message/timeline consistency, Web/Mobile/PWA/Desktop readback, and governance evidence.
- Excluded: final demo package, 3-minute demo material, and pure P2 work that has not started.

## Sources Of Truth

- `bytedance_init_prd.md`
- `bytedance_init_video_txt.txt`
- `.trellis/spec/cross-layer/real-flow-acceptance.md`
- `research/contracts/BYTEDANCE-P0-P1-FINAL-COMPLETION-GATE.md`
- `research/sequential-execution-progress.md`
- `research/project-tracker.md`
- Relevant execution reports under `research/execution-reports/`

## Requirements

- Build a final gap inventory from tracker, sequential progress, execution reports, strict gate output, and any user-review failure markers. Any `partial`, `not-run`, `blocked`, failed, or user-rejected P0/P1 item must be repaired or explicitly kept open.
- IM main flow must record Orchestrator, backend engineer, frontend engineer, final acceptance, artifact recommendation, and artifact confirmation in the central IM with durable message evidence.
- Role runtime evidence must include concrete role/runtime/handoff metadata such as `metadata.handoffsReceived`, `roleHandoffs`, runtime/session identifiers, or equivalent auditable data.
- Permission flow must support:
  - Full-control mode: no manual approval card blocks the original chain.
  - Manual allow: approval state becomes allowed/approved and the original plan node/mailbox/runtime session continues.
  - Manual reject: side effects stop, no final artifact/deploy is created, and IM shows waiting or failure state.
- Workbench must keep Git, file tree, code references, artifacts, right panel resize width, and artifact launch script visible, operable, refreshable, and readable after reload.
- Web, Mobile/PWA, and Desktop/Electron must each have explicit surface results and evidence paths.
- Runtime product flows must use real database/API/session behavior. Timeline-only results, unit-test-only proofs, mock runtime data, and historical pass evidence are not acceptable as final proof.

## Public Interface Contract

- Do not invent new product concepts to satisfy the gate.
- Keep existing `/api/chat`, messages, timeline, actions, artifacts, and workspace Git/File APIs consistent.
- If event or metadata shape changes are needed, they must preserve:
  - messages readback as IM-first process evidence,
  - auditable role handoff metadata,
  - permission action state and UI copy consistency,
  - durable artifact row plus IM result card for artifact recommendation/confirmation.

## Acceptance Criteria

- [ ] Fresh strict single-prompt gate passes with prompt: `做一个加减乘除的简单网站，使用sqlite存储历史记录`.
- [ ] Full-control scenario runs from one user input to final artifact delivery without a manual approval card blocking the chain.
- [ ] Manual allow scenario changes approval state to `已允许` or `已审批` and continues the same original chain.
- [ ] Manual reject scenario stops side effects and waits/fails visibly without final artifact/deploy creation.
- [ ] Web, Mobile/PWA, and Desktop/Electron evidence is produced by OpenCLI or Playwright with entry URL/app, surface, result, and evidence paths.
- [ ] Final report includes `sessionId`, `workspaceId`, `GET /api/messages?session_id=...`, `GET /api/sessions/:sessionId/timeline`, and tri-surface evidence paths.
- [ ] Relevant unit/API/store/component tests pass.
- [ ] Type-check, lint, build, `git diff --check`, Trellis validation if available, and governance/evidence audit pass.
- [ ] `research/sequential-execution-progress.md`, `research/project-tracker.md`, and the relevant execution report are updated with fresh evidence.
- [ ] No P0/P1 item remains `partial`, `blocked`, `not-run`, or `failed` while this task is marked complete.

## Definition Of Done

- Code and test fixes are committed in scoped commits.
- Governance/tracker/report files are synchronized.
- `bash scripts/verify-governance-gate.sh BYTEDANCE-P0-P1-FINAL-COMPLETION-GATE` exits 0, or any script limitation is documented with equivalent evidence.
- Any reusable acceptance rule learned during this task is captured in `.trellis/spec`.

## Out Of Scope

- Final demo package.
- 3-minute demo素材.
- Pure P2 features that are not already required by P0/P1 completion.

## Technical Notes

- Existing dirty baseline before this task: `.workflow/.scratchpad/uat-gap-audit/browser-findings.json` has a pre-existing newline-only change and should not be included unless directly audited.
- This task is governed by the project workflow in `research/workflow/ai-workflow-control.md`.
