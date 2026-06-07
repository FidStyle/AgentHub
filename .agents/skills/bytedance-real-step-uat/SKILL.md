---
name: bytedance-real-step-uat
description: "Run or plan Bytedance P0/P1 final acceptance with real user-perspective step-by-step UAT. Use when the user says Bytedance 全真实验收, 最终验收, 不相信历史 pass, 模拟用户全流程, 每一步验证状态, P0/P1 全部完成, or asks whether Bytedance requirements are truly complete."
---

# Bytedance Real-Step UAT

Use this project-local skill when a user asks for Bytedance P0/P1 completion, final acceptance, full real UAT, or distrusts historical pass reports.

## Load First

Read these files before planning, running, or judging acceptance:

1. `.trellis/spec/cross-layer/real-flow-acceptance.md`
   - Scenario: `Bytedance P0/P1 Real-Step UAT`
2. `research/contracts/BYTEDANCE-P0-P1-REAL-STEP-UAT.md`
3. `.trellis/spec/guides/end-to-end-contract-planning.md`
   - Section: `Bytedance P0/P1 Real-Step UAT Trigger`
4. Current tracker/progress files that mention Bytedance P0/P1, including:
   - `research/sequential-execution-progress.md`
   - `research/project-tracker.md`
   - relevant `research/execution-reports/`

If a Trellis task is active, add the spec and contract to task context:

```bash
python3 ./.trellis/scripts/task.py add-context <task> implement .trellis/spec/cross-layer/real-flow-acceptance.md "Bytedance real-step UAT acceptance source of truth"
python3 ./.trellis/scripts/task.py add-context <task> check research/contracts/BYTEDANCE-P0-P1-REAL-STEP-UAT.md "Bytedance real-step UAT evidence contract"
```

## Required Behavior

- Run from a fresh canonical prompt unless the user explicitly asks for a narrower diagnostic.
- Canonical prompt: `做一个加减乘除的简单网站，使用sqlite存储历史记录`
- Verify state after every important user-visible action before continuing.
- For each step, capture UI, API, DB, runtime/file, and IM evidence where applicable.
- Treat historical reports as leads only.
- Fail closed: any P0/P1 `partial`, `blocked`, `not-run`, or `failed` means the final answer is not complete.

## Minimum Evidence Shape

The final report must include:

- `sessionId`, `workspaceId`, `planId`, and fresh-run marker.
- Web, Mobile/PWA, and Desktop/Electron evidence paths.
- `GET /api/messages?session_id=<sessionId>` evidence.
- `GET /api/sessions/<sessionId>/timeline` evidence.
- DB/readback evidence for messages, plans, nodes, mailbox items, actions, runtime sessions, artifacts, and role handoffs.
- Permission results for full-control, manual allow, and manual reject.
- Workbench results for Git, file tree, code references, artifacts, deploy/runtime startup, and refresh/readback.
- Product results for calculator operations, guards, SQLite history persistence, and refresh readback.

## Status Language

Do not say `完全通过` unless every required line in the current run is `pass`.

Use this wording when blockers remain:

```text
还没有完全通过。当前 fresh UAT 中 <line> 是 <status>，证据是 <path/id>，下一步需要修复 <blocker> 后重跑同一条线。
```
