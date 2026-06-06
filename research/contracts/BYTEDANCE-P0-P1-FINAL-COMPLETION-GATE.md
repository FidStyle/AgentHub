# BYTEDANCE-P0-P1-FINAL-COMPLETION-GATE: Bytedance P0/P1 final completion gate

> This contract is the shared fact interface for the final P0/P1 completion gate. Trellis implementation, test evidence, execution reports, and Codex acceptance must reference this file.

## 1. Metadata

| Field | Content |
| --- | --- |
| TASK-ID | `BYTEDANCE-P0-P1-FINAL-COMPLETION-GATE` |
| Priority | `P0` |
| Bound FR-ID | P0/P1 Bytedance MVP flows for IM, Agent orchestration, permissions, workbench, runtime, artifacts, and tri-surface readback |
| Sources | `bytedance_init_prd.md`, `bytedance_init_video_txt.txt`, `.trellis/spec/cross-layer/real-flow-acceptance.md`, `research/sequential-execution-progress.md`, `research/project-tracker.md`, `research/execution-reports/` |
| Owner roles | Codex controls workflow and final acceptance; Trellis owns implementation specs and task context |
| Status | active |

## 2. Background And Goal

AgentHub must close all Bytedance P0/P1 product requirements with fresh, strict evidence. This is not a demo-packaging task and not a P2 feature expansion. It is the final product gate for existing P0/P1 obligations: any gap found in the public tracker, sequential progress, reports, strict gate output, or user-review failures must be repaired and re-verified.

## 3. User Flow Contract

1. A real user starts a new session from Web, Mobile/PWA, or Desktop/Electron and sends: `做一个加减乘除的简单网站，使用sqlite存储历史记录`.
2. The system persists session, workspace, messages, role orchestration, permission decisions, runtime events, artifacts, and timeline entries through real DB/API/session behavior.
3. The central IM shows Orchestrator planning plus backend engineer, frontend engineer, final acceptance, artifact recommendation, and user confirmation/result cards.
4. Permission mode drives real behavior:
   - Full-control continues without manual approval blocking.
   - Manual allow updates status to allowed/approved and resumes the same chain.
   - Manual reject stops side effects and does not create final deploy/artifact.
5. Workbench surfaces remain usable and refreshable: Git, file tree, code references, artifacts, right panel resize width, and artifact launch script.
6. Web, Mobile/PWA, and Desktop/Electron can read back the same session/workspace evidence with surface-specific UI.
7. Completion exists only when API readback, timeline, persisted artifacts, and tri-surface evidence all agree.

## 4. Three-Surface Boundary

| Surface | Responsibility | Does Not Do |
| --- | --- | --- |
| Web | Primary IM/workspace/artifact experience, strict gate creation, messages/timeline/workbench readback | Hide missing runtime evidence behind timeline-only cards |
| Desktop/Electron | Local capability shell, Desktop session/workspace readback, runtime/host state, workbench access | Claim pass if only web browser was exercised |
| Mobile/PWA | Lightweight session review, permission supervision, artifact preview/readback | Claim pass without a mobile-sized browser/PWA evidence artifact |

## 5. Data And Backend Contract

- Database: workspace, session, message, action, permission, runtime, and artifact evidence must be durable where the product flow requires durability.
- Migration/seed: tests may use dev/test fixtures, but product runtime cannot return in-memory mock success for the main chain.
- Auth/session: evidence must include concrete `sessionId` and `workspaceId`.
- API: final report must include `GET /api/messages?session_id=...` and `GET /api/sessions/:sessionId/timeline` readback.
- Permission/error semantics: UI action state and API action state must use the same allowed/approved/rejected/waiting/failure meaning.

Product runtime may use mock main-flow data: **no**.

## 6. UI/UX Contract

- User-visible copy must be Simplified Chinese.
- IM is the primary evidence surface; timeline supports but cannot replace it.
- Permission cards must expose clear allowed/approved/rejected/waiting/failure states.
- Workbench panels must not disappear after refresh or resize.
- Desktop, Web, and Mobile may differ in layout but must preserve the same state semantics.

## 7. Reference Input

No new external reference project is required for this gate. Existing project research and contracts remain binding.

## 8. Trellis Derivation

- Task PRD: `.trellis/tasks/06-07-bytedance-p0-p1-final-completion-gate/prd.md`
- Implementation context: backend, frontend, cross-layer specs, and this contract.
- Check context: quality, real-flow acceptance, PRD backtrace audit, and this contract.
- Spec updates: only if this gate discovers reusable acceptance rules.

## 9. Maestro/Ralph Derivation

No separate Maestro/Ralph run is required by this Codex task. If later delegated, Maestro/Ralph must use this contract and must not treat `.workflow/.maestro/*/status.json` as completion.

## 10. Test And Acceptance Contract

Automated or scripted verification must cover:

- Type-check, lint, build, and `git diff --check`.
- Affected unit/API/store/component tests.
- Fresh strict single-prompt gate for `做一个加减乘除的简单网站，使用sqlite存储历史记录`.
- Full-control, manual allow, and manual reject permission scenarios.
- Web, Mobile/PWA, and Desktop/Electron readback using OpenCLI or Playwright.
- Database/API readback for messages, timeline, artifacts, and permission/action state.

Manual acceptance is not a substitute for missing automated evidence. Any single P0/P1 item left `partial`, `blocked`, `not-run`, or `failed` prevents completion.

## 11. Plan-Stage Forbidden Items

- Historical pass evidence as final proof.
- Timeline-only proof for IM-first requirements.
- Unit tests in place of real user-chain verification.
- Mock runtime/database/API/session success for MVP product flows.
- Claiming tri-surface pass when one surface was not run.
- Adding Demo/P2 scope to hide P0/P1 incompleteness.

## 12. Verification Sample

| Sample | Contract Description | Do Not Preset | Pass Standard |
| --- | --- | --- | --- |
| Strict calculator app prompt | Start a fresh real session and build a simple add/subtract/multiply/divide website using sqlite history storage | Do not pre-author a fake artifact or hard-code a pass result | Messages, timeline, workspace, artifact, permissions, and tri-surface readback all contain durable evidence |

## 13. Completion Gate

- [ ] `research/project-tracker.md` updated.
- [ ] `research/sequential-execution-progress.md` updated.
- [ ] Relevant execution report updated with fresh evidence paths.
- [ ] Regression ledger updated if any issue remains open.
- [ ] `bash scripts/verify-governance-gate.sh BYTEDANCE-P0-P1-FINAL-COMPLETION-GATE` exits 0 or a documented equivalent audit exists.
- [ ] Scoped commit only includes this task's files and excludes unrelated dirty files.
- [ ] Codex performs independent final acceptance against this contract.

## 14. Residual Risk

Any P0/P1 evidence gap discovered during verification must remain open in tracker/report and blocks task completion.
