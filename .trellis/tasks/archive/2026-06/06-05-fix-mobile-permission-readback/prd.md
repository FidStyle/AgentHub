# fix Mobile/PWA permission detail readback

## Background

This P0 task continues the single-branch sequential queue after `06-05-fix-ask-user-question-native-tool`.

Highest product truth remains:

- `bytedance_init_prd.md`
- `bytedance_init_video_txt.txt`

Current regression source:

- `research/regression-ledger.md` / `REG-20260605-002`
- `research/execution-reports/approved-native-tool-continuation-uat-2026-06-05.md`
- `research/sequential-execution-progress.md`

The failing UAT case proved Web and DB have the approved `read_file` permission metadata for action `d23a4396-a3e0-4521-a91c-644bc3291911`, but Mobile/PWA route `/m/sessions/b7cb9b2d-227a-4188-8c41-95319936acc3` only showed plan/message text and did not show the durable permission detail/card after reload.

## Goal

Mobile/PWA session readback must show durable permission/action metadata for the same session after reload, including decided states. Web evidence or DB-only evidence cannot substitute for the Mobile/PWA surface.

## Requirements

1. Mobile/PWA `/m/sessions/:sessionId` must fetch durable actions for the session using the real API/session/auth path.
2. It must render a mobile permission detail/card for each durable action relevant to the session.
3. The card must include:
   - status text for pending/approved/running/completed/failed/rejected/cancelled;
   - action kind/type;
   - command/tool label;
   - cwd/workspace root when available;
   - target paths when available;
   - risk level and approval requirement.
4. Pending actions must remain actionable from Mobile/PWA using the existing real approval API when safe.
5. Approved/terminal actions must be read-only and clearly show the decided state, for example `已允许本次执行`.
6. Existing `runtimeParts.permission` rendering must keep working; durable action rows should cover refresh/readback when message parts are missing or insufficient.
7. Do not claim the fixed calculator + SQLite sample complete unless the real runtime produces the artifact and it is verified.
8. Do not start unstarted P2 work.

## Verification

- Focused Mobile/PWA component or page test for durable action card detail.
- Focused `/api/actions?session_id=` ownership/readback test if route behavior changes.
- Web type-check and lint.
- OpenCLI Mobile/PWA real route readback evidence showing the permission detail/card for the same session.
- Web/OpenCLI evidence may be used only as supporting context, not as the Mobile/PWA pass condition.
- Electron fallback smoke if the tri-surface report requires confirming desktop build remains unaffected.

## Completion

The task is complete only after code, tests, OpenCLI Mobile/PWA evidence, execution report, `research/sequential-execution-progress.md`, `research/regression-ledger.md`, and `research/project-tracker.md` are updated, then committed, archived, and journaled before the next task starts.
