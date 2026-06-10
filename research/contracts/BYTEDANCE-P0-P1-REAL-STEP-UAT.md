# Bytedance P0/P1 Real-Step UAT Contract

## Purpose

This contract defines how AgentHub must be tested when the user asks whether the Bytedance P0/P1 requirements are truly complete. It is intentionally stricter than feature-level tests because previous reports allowed UI-only, backend-only, historical-pass, and partial-minimum implementations to look complete.

## Source Of Truth

- Primary executable spec: `.trellis/spec/cross-layer/real-flow-acceptance.md`, Scenario `Bytedance P0/P1 Real-Step UAT`.
- Planning checklist: `.trellis/spec/guides/end-to-end-contract-planning.md`, section `Bytedance P0/P1 Real-Step UAT Trigger`.
- Product requirement inputs: `bytedance_init_prd.md`, `bytedance_init_video_txt.txt`, and `bytedance_user_requirements_and_test_prompt.md` when present.
- Historical execution reports are clues only; they are not final pass evidence.

## Scope

The UAT must cover the same fresh session across:

- Web AgentHub.
- Mobile/PWA AgentHub.
- Desktop/Electron AgentHub, or a clearly documented Electron fallback.
- Central IM process evidence.
- Runtime/agent orchestration and role handoffs.
- Permission full-control, manual allow, and manual reject.
- Workbench Git/file tree/code reference/artifact/deploy behavior.
- Generated product behavior for the canonical calculator prompt, including SQLite history.

## Completion Rule

The Bytedance P0/P1 gate is complete only when every P0/P1 line is `pass` in the current run.

Any `partial`, `blocked`, `not-run`, or `failed` line means the answer must be "not complete" and the report must name the next blocker. Do not use old pass labels, timeline-only evidence, unit tests, or generated-product-only smoke tests to override this rule.

If a newer fresh marker fails after an older fresh marker passed, the newer failure reopens the gate. Historical pass evidence remains useful for regression comparison, but it cannot override the newer failed marker.

## Required Evidence

Every final report must include:

- `sessionId`, `workspaceId`, `planId`, and fresh-run timestamp or durable marker.
- `GET /api/messages?session_id=<sessionId>` evidence.
- `GET /api/sessions/<sessionId>/timeline` evidence.
- DB/readback evidence for messages, plans, nodes, mailbox items, actions, runtime sessions, artifacts, role handoffs, and generated product files.
- Web, Mobile/PWA, and Desktop/Electron evidence paths.
- Permission evidence for full-control, manual allow, and manual reject.
- Workbench evidence for Git, file tree, code references, artifact row, deploy/runtime startup, and refresh/readback.
- Product evidence for add/subtract/multiply/divide, validation guards, SQLite insert/readback, refresh persistence, and history ordering.

## Current Reopened Blockers

As of 2026-06-10, the historical pass markers `BYTEDANCE-CURRENT-FINAL-1781025161` and `BYTEDANCE-PERMISSION-FINAL-1781025780` are no longer sufficient as final evidence because newer fresh runs failed:

- `STRICT-SPD-1781034360339-3a63e1`: strict product delivery failed with `finalArtifactId=null`, plan still running, and generated workspace `npm test` failing due to missing `supertest`.
- `PERMISSION-BRANCH-1781034038005-a684c9`: manual permission branch preflight failed because a real runtime executor and live runtime worker were required.
- `PERMISSION-BRANCH-1781034095538-b05c35`: manual allow/reject flow was routed to an `agent_draft` result card instead of producing the target permission approval path.

These blockers must be fixed and a newer fresh full-control + manual allow/reject + three-surface run must pass before this contract can be marked complete again.

## Manual Trigger Text

The following natural-language requests must route to this contract:

- `跑 Bytedance 全真实验收`
- `Bytedance P0/P1 最终验收`
- `不要相信历史 pass，按用户视角每一步验证`
- `模拟用户测试全流程，每做一步就验证状态`
- `看看 Bytedance 现在是不是真的全部完成`
- `用真实 Web/Mobile/Desktop 跑一遍 Bytedance P0/P1`
