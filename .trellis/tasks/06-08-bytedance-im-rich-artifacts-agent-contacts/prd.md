# Bytedance IM rich artifacts and Agent contacts

## Goal

补齐 Bytedance IM 工作台中的“联系人 + 群聊 + 富媒体产物复用”主体验，让 Web 端以 Role Agent 为联系人入口，以 session 为可命名群聊/单聊承载，IM 内联卡和右侧产物 tab 复用同一份 durable artifact，并为 Markdown/PPT/网页预览提供真实 API 与 UI 闭环。

## Sources

- User supplied plan: Bytedance IM / 富媒体产物 / Agent 联系人补齐计划。
- `research/index.md`
- `research/workflow/ai-workflow-control.md`
- `research/contracts/REMAINING-P1-FEATURES-2026-06-05.md`
- `research/contracts/RICH-DOC-PPT-ARTIFACTS-2026-06-03.md`
- `.trellis/spec/frontend/component-guidelines.md`
- `.trellis/spec/frontend/quality-guidelines.md`
- `.trellis/spec/backend/runtime-workspace-contract.md`
- `.trellis/spec/cross-layer/real-flow-acceptance.md`

## Scope

- Add conversation read model/API that merges Role Agent contacts and active/archived chat sessions.
- Add group conversation creation with named session and selected role participants.
- Extend session and role-agent contracts with optional fields needed by the product plan: pinning, chat kind, direct role agent, last activity, toolsets, and participants. The implementation must remain compatible with the current local test DB shape.
- Add direct-contact lazy session creation/reuse in the frontend store.
- Enforce direct/group recipient semantics in `/api/chat`: direct sessions target the bound role and reject extra `@`; group sessions only accept participants.
- Add role-agent draft API and toolset validation helpers.
- Extend `RuntimeMessagePart` and message rendering for attachment, web preview, publish status, artifact cards, and diff apply affordance.
- Add presentation generation/preview API with honest dependency errors and fallback behavior.
- Add diff-apply approval API that validates unified diff and workspace paths before creating a pending action.
- Add focused unit/component tests for the new contracts.

## Out of Scope

- Full online PPT editing.
- Vendoring `ppt-master` into the repo.
- Production database migration files if no migration system exists in this repo; types and API contracts must still expose the fields.
- Final Bytedance Web/Mobile/Desktop UAT pass. This task adds implementation and regression coverage; final UAT remains governed by the existing UAT tasks.

## Requirements

1. `GET /api/conversations?workspace_id=...&status=active|archived|all` returns rows with `kind`, `id`, `title`, `roleAgentId`, `sessionId`, `isPinned`, `lastActivityAt`, `lastMessage`, and `participants`.
2. Contact rows are derived from `role_agents` and remain visible even if their direct session is archived or absent.
3. Group rows are derived from sessions whose `chat_kind` is `group` or that have participant metadata.
4. Sorting is pinned first, then `lastActivityAt desc`, with contacts and groups in one list.
5. `POST /api/conversations/groups` creates a named group session and participant rows or participant metadata fallback.
6. Session PATCH accepts `name`, `status`, and `is_pinned`, updating `updated_at` and `last_activity_at` where supported.
7. Direct contact selection lazily creates/reuses a direct session and hides the composer role picker.
8. Group conversations show role targeting only for participants; if no explicit target is given, use orchestrator when present, otherwise all participants.
9. `POST /api/role-agents/draft` returns a deterministic draft with recommended toolsets from a natural language prompt.
10. Role Agent create/update validates toolset IDs against built-ins and persists them where supported.
11. Runtime/action dispatch permission checks must have a reusable `assertRoleAgentToolset` helper for file, shell, git, artifact, publish, web fetch, and PPT actions.
12. Runtime message part types include `attachment`, `web_preview`, `publish_status`, richer `artifact`, and diff apply metadata.
13. IM cards render attachments, web previews, publish status, diff apply, artifact open/download, and full-screen preview actions.
14. `POST /api/artifacts/presentations/generate` creates a presentation artifact and `.pptx` file when dependencies are available, otherwise returns a precise dependency error.
15. `POST /api/artifacts/:id/preview` returns presentation PDF preview state or fallback slide summary; web artifacts return publish preview state.
16. `POST /api/workspaces/:id/diff/apply` validates a unified diff and creates a pending apply-diff approval action; it must reject invalid diff and outside-workspace paths.

## Acceptance Criteria

- API tests cover conversation merge/sort/filter, group create, session pin patch, role-agent draft/toolsets, presentation dependency failure, and diff apply rejection/success.
- Component/store tests cover contacts/groups in the left list, direct contact composer behavior, and rich message cards.
- Existing regression commands attempted:
  - `pnpm --filter @agenthub/web test`
  - `pnpm --filter @agenthub/web type-check`
  - `pnpm --filter @agenthub/shared type-check`
  - `pnpm --filter @agenthub/web lint`
  - `git diff --check`

## Implementation Notes

- The repo currently has no migration directory; DB-facing code must use optional fields defensively and preserve existing tests.
- `apps/web` already has session/message/artifact APIs and right-panel previews; prefer extending those instead of creating a parallel model.
- `apps/web/components/workspace/MessageContent.tsx` owns runtime part rendering.
- `apps/web/store/session-store.ts` owns the left list and message stream state.
- `packages/shared/src/domain/message.ts`, `role-agent.ts`, `session.ts`, and `database.types.ts` own shared contracts.
