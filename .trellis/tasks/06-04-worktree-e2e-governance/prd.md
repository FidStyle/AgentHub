# brainstorm: worktree cleanup and tri-surface e2e governance

## Goal

Define the next controller-level dispatch plan for removing duplicate chat copy controls, requiring real opencli E2E across Web/Desktop/Mobile where relevant, and deciding which existing feature worktrees plus Codex sessions should be kept, cleaned up, or replaced.

## What I already know

* User wants the extra `class="flex shrink-0 items-center gap-1"` copy-control row removed for the chat message surface, keeping the single existing top bar `class="mb-1 flex items-start justify-between gap-2"`.
* User does not want a separate duplicated copy button; the product should have one message top bar.
* User wants every assigned feature lane to run E2E tests, preferably through opencli so Web browser and Electron can reuse real browser/auth state.
* User wants each feature lane to decide whether its scope must cover Web, Desktop, and Mobile; chat/state-related features should usually update Web and Mobile together, while Electron-only features can remain separate.
* User wants state semantics unified so future lanes do not drift across Web/Desktop/Mobile.
* Controller may update specs and pass changed spec requirements to existing worktree sessions through follow-up prompts.

## Repo facts discovered

* Current integration branch is `AgentHub_new_claude_test`.
* Existing worktrees:
  * `/Users/joytion/Documents/code/agenthub-worktrees/chat-polish` on `feature/chat-im-polish`, clean.
  * `/Users/joytion/Documents/code/agenthub-worktrees/deploy-v1` on `feature/deploy-v1`, clean.
  * `/Users/joytion/Documents/code/agenthub-worktrees/mini-ide` on `feature/mini-ide-agentic-edit`, dirty: `.trellis/spec/cross-layer/real-flow-acceptance.md`, untracked `.trellis/workspace/codex/`.
  * `/Users/joytion/Documents/code/agenthub-worktrees/orchestrator-spike` on `spike/orchestrator-execution-model`, clean.
  * `/Users/joytion/Documents/code/agenthub-worktrees/rich-artifacts` on `feature/rich-doc-ppt-artifacts`, dirty: `.trellis/spec/cross-layer/real-flow-acceptance.md`, `research/index.md`, untracked `research/contracts/RICH-DOC-PPT-ARTIFACTS-2026-06-03.md`, untracked `.trellis/workspace/codex/`.
  * `/Users/joytion/Documents/code/agenthub-worktrees/role-runtime-workspace-permissions` on `feature/role-runtime-workspace-permissions`, clean.
  * `/private/tmp/agenthub-integration-main-merge` on `integration/lane-merge-20260603`, clean but not the current integration target.
* Duplicate copy-control candidates:
  * `apps/web/components/workspace/ChatPanel.tsx` has `mb-1 flex items-start justify-between gap-2` and a nested `flex shrink-0 items-center gap-1` copy button.
  * `apps/web/components/workspace/MessageMarkdown.tsx` has a message-level copy wrapper and code-block copy controls.
  * `apps/web/components/orchestrator/PlanCard.tsx` and `apps/web/components/workspace/SessionList.tsx` also contain `flex shrink-0 items-center gap-1`, but they are not the user-described chat duplicate unless confirmed by UI inspection.

## Assumptions

* The duplicate copy-button fix belongs to a Web IM/chat lane, not mini-ide, rich-artifacts, deploy, or role-runtime.
* Existing feature worktrees whose results are already merged should not be reused for new unrelated work unless the branch owner explicitly wants to continue there.
* Dirty feature worktrees should not be deleted until their uncommitted specs/contracts/workspace state are reviewed or intentionally discarded by the lane owner.
* Controller should not directly edit business UI code; it should dispatch the fix and enforce E2E/spec requirements.

## Requirements

* Assign the duplicate chat copy-control cleanup to the lane that owns Web IM/message rendering.
* Require the assigned lane to inspect whether the fix also affects Mobile chat message rendering and shared message state.
* Require opencli E2E evidence for every feature lane before integration:
  * Web browser flow when Web UI or shared state changes.
  * Electron flow when Desktop/local runtime/auth/host behavior changes.
  * Mobile/PWA flow when chat/session/artifact/approval state is user-visible on Mobile.
* Require each lane final report to state: surfaces inspected, surfaces changed, surfaces intentionally out of scope, and exact E2E commands/artifacts.
* Decide worktree disposition before starting new sessions:
  * delete only clean, already-merged, no-longer-needed worktrees;
  * keep dirty or still-active worktrees;
  * create a new worktree only when no existing clean lane matches the scope.
* Preserve controller boundary: no business-code edits in the integration branch.

## Proposed Dispatch

* Duplicate chat copy-control cleanup:
  * Owner: Web IM/chat lane.
  * Recommended worktree: create a fresh worktree from current `AgentHub_new_claude_test`, for example `/Users/joytion/Documents/code/agenthub-worktrees/message-actions-topbar` on `feature/message-actions-topbar-e2e`.
  * Reason: existing `chat-polish` is clean but stale and already merged/archived; reusing it risks missing newer integration commits.
  * Required scope decision by assignee: inspect Web `ChatPanel` and `MessageMarkdown`, then inspect Mobile/PWA chat renderer/store for the same duplicated message-action semantics. Desktop only if the same shared renderer or message state is consumed there.
  * Required E2E: OpenCLI Web real-browser UAT on a fixed lane port; Mobile/PWA opencli/browser mobile viewport or project mobile E2E if chat UI/state is affected; Playwright unit/regression is supplemental.

## Worktree Disposition Draft

* Delete candidate after final confirmation:
  * `chat-polish`: clean; prior result merged into integration history; do not reuse for new work.
  * `deploy-v1`: clean; prior result merged into integration history.
  * `orchestrator-spike`: clean and `spike/orchestrator-execution-model` is an ancestor of current HEAD; delete if no human session is still using it.
  * `/private/tmp/agenthub-integration-main-merge`: clean temp integration worktree; not the current target branch, delete if no manual comparison is pending.
* Keep:
  * `mini-ide`: dirty Trellis spec/workspace files and active task remains; do not delete.
  * `rich-artifacts`: dirty spec/index/contract/workspace files and public governance gate remains incomplete; do not delete.
  * `role-runtime-workspace-permissions`: clean, but P0 task remains active and public governance gate is incomplete; keep until tracker/report/UAT decision is closed.
* Create:
  * `feature/message-actions-topbar-e2e` from current `AgentHub_new_claude_test` for the duplicate message copy-control cleanup.

## Reusable E2E Prompt Snippet

Every feature lane must finish with:

* Surface decision: list Web, Desktop/Electron, Mobile/PWA as `changed`, `inspected-no-change`, or `not-applicable`, with reason.
* OpenCLI first: use opencli for real browser/PWA or Electron/app UAT where available; only fall back to Playwright Electron when opencli capability is missing and record that reason.
* Fixed lane port: declare `BASE_URL` and port in the report; automatic port fallback is not passing evidence.
* Evidence: save screenshot/DOM/state evidence and list exact commands. Skipped, blocked, login-required, or permission-required flows must be reported as not-run, not passed.
* State consistency: for shared message/session/artifact/approval/runtime state, verify refresh/readback and cross-surface terminology/status consistency.

## Acceptance Criteria

* [ ] A concrete owner/worktree/session is selected for the duplicate chat copy-button fix.
* [ ] A prompt is ready for that owner requiring code change plus opencli E2E.
* [ ] A worktree cleanup list identifies delete/keep/create decisions and reasons.
* [ ] A reusable E2E requirement snippet is ready to pass to feature sessions.
* [ ] If spec updates are needed for tri-surface state/E2E expectations, they are limited to `.trellis/spec` and passed to active lanes.

## Definition of Done

* Controller branch remains clean after planning or ledger-only edits are committed.
* No business code is edited by the controller.
* Existing dirty worktrees are not deleted.
* Any new worktree/session recommendation states the branch name, cwd, task owner, and required E2E scope.

## Out of Scope

* Directly implementing the Web copy button removal in the controller branch.
* Deleting dirty worktrees without owner confirmation.
* Claiming UAT complete without opencli/browser/Electron/Mobile evidence.

## Technical Notes

* Relevant user-visible chat files discovered by search: `apps/web/components/workspace/ChatPanel.tsx`, `apps/web/components/workspace/MessageMarkdown.tsx`.
* Relevant existing task lanes: `06-03-mini-ide-agentic-edit`, `06-03-rich-doc-ppt-artifacts`, `06-03-role-runtime-workspace-permissions`, `06-03-oss-component-migration-workbench-upgrade`.
* Prior governance gap: `ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03` and `RICH-DOC-PPT-ARTIFACTS-2026-06-03` are missing public tracker/test-evidence gate entries in the integration branch.
