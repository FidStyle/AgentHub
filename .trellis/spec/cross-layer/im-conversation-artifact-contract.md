# IM Conversation and Artifact Contract

## Scenario: Contacts, Groups, Rich Artifact Cards

### 1. Scope / Trigger

- Trigger: any change to Web IM contacts, session list, role-agent toolsets, rich message cards, presentation generation, publish preview, or diff apply from IM.
- Applies to: `packages/shared/src/domain/*`, `docker/postgres/acceptance-schema.sql`, `/api/conversations*`, `/api/chat`, `/api/role-agents*`, `/api/artifacts*`, `/api/workspaces/:id/diff/apply`, `session-store`, `SessionList`, `ChatPanel`, and `MessageContent`.

### 2. Signatures

- `GET /api/conversations?workspace_id=...&status=active|archived|all`
- `POST /api/conversations/groups` with `{ workspace_id, name, participant_role_agent_ids[] }`
- `PATCH /api/sessions/:id` with `{ name?, status?, is_pinned? }`
- `POST /api/role-agents/draft` with `{ workspace_id, prompt }`
- `POST /api/artifacts/presentations/generate` with `{ workspace_id, session_id?, source_path?, prompt?, title? }`
- `POST /api/artifacts/:id/preview`
- `POST /api/workspaces/:id/diff/apply` with `{ session_id, message_id?, diff }`
- DB: `sessions.chat_kind`, `sessions.direct_role_agent_id`, `sessions.participant_role_agent_ids`, `sessions.is_pinned`, `sessions.pinned_at`, `sessions.last_activity_at`, `session_participants`, `role_agents.toolset_ids`.

### 3. Contracts

- Contact rows are derived from `role_agents`; they are not deleted or hidden by archiving a direct session.
- Direct sessions bind one `direct_role_agent_id`; `/api/chat` rejects attempts to target a different role.
- Group sessions bind participant role IDs; `/api/chat` rejects mentions outside participants and defaults to the group orchestrator or all participants.
- Conversation sorting is pinned first, then `lastActivityAt desc`.
- Toolsets are executable boundaries, not display tags. Unknown `toolset_ids` must be rejected on role-agent create/update.
- Rich IM cards must use `RuntimeMessagePart` discriminants, not parse arbitrary text to infer card kinds.
- Diff apply creates a pending action; it does not directly mutate files before approval.
- Presentation generation must create a durable `presentation` artifact and a real `.pptx` file, or return an explicit dependency/workspace error.

### 4. Validation & Error Matrix

| Condition | Error / Behavior |
| --- | --- |
| Missing `workspace_id` | `400 缺少 workspace_id` |
| Group has no participants | `400 至少选择一个联系人` |
| Group participant is not in workspace | `403 群聊联系人不存在或无权限` |
| Direct session targets another role | `400 单聊会话不能 @ 其他联系人` |
| Group mentions non-participant | `400 群聊只能 @ 已加入的联系人` |
| Invalid toolset | `400 未知工具集` |
| Invalid diff | `400 不是合法 unified diff` |
| Diff path outside workspace | `400 Diff 包含 workspace 外路径` |
| Presentation preview without `soffice` | `summary` fallback with slide summaries, not a claimed PDF preview |

### 5. Good/Base/Bad Cases

- Good: `GET /api/conversations` returns `contact` rows for role agents and `group` rows for group sessions in one sorted list.
- Base: a contact without a direct session is selectable; the UI lazily creates the direct session before loading messages.
- Bad: UI hides the role picker for direct chat but `/api/chat` still accepts a different `roleAgentIds` target.
- Bad: diff card applies patches immediately from the browser click without creating an approval action.
- Bad: PPT endpoint returns success while only storing JSON and no downloadable PPTX file.

### 6. Tests Required

- API tests for conversation merge/sort/filter and group creation.
- API tests for role-agent draft and invalid toolset rejection.
- API tests for valid/invalid diff apply action creation.
- Chat API tests for direct/group recipient enforcement when those session fields are present.
- Store/component tests for `/api/conversations` consumption and contact/group rendering.
- Type-checks for shared `RuntimeMessagePart` union consumers, including Mobile/PWA.

### 7. Wrong vs Correct

#### Wrong

```typescript
// UI-only direct chat: backend can still send to arbitrary roles.
sendMessage({ roleAgentIds: selectedRoles.map((role) => role.id) })
```

#### Correct

```typescript
// Backend owns the invariant.
if (session.chat_kind === 'direct' && requestedRoleIds.some((id) => id !== session.direct_role_agent_id)) {
  return Response.json({ error: '单聊会话不能 @ 其他联系人' }, { status: 400 })
}
```
