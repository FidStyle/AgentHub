# Role Agent Tools / Tags / Runtime Contract

## Scenario: Project-Wide Role Agent Tool Boundary

### 1. Scope / Trigger

- Trigger: any Web, Mobile/PWA, Desktop, Backend, Runtime, DB, seed, or test change that reads, writes, displays, or enforces Role Agent abilities.
- Applies to: Role Agent API/UI, chat routing, Orchestrator dispatch, runtime/action permission checks, acceptance schema, seed scripts, mobile/desktop readback, and tests.

### 2. Signatures

- `GET /api/tools/catalog`
  - Response: `{ tools: Array<{ id, label, description, riskLevel, category }> }`
- `POST /api/role-agents/draft`
  - Request: `{ workspace_id: string, prompt: string }`
  - Response includes `capability_tags: string[]`, `enabled_tool_ids: RoleAgentToolId[]`, `runtime_type`.
- `POST /api/role-agents` / `PATCH /api/role-agents/:id`
  - Request fields: `capability_tags?: string[]`, `enabled_tool_ids?: RoleAgentToolId[]`, `runtime_type?: "claude_code" | "codex"`.
- DB: `role_agents.capability_tags jsonb DEFAULT '[]'`, `role_agents.enabled_tool_ids jsonb DEFAULT '[]'`.

### 3. Contracts

- `capability_tags` are display-only labels. Store without `#`; render as colored `#xxx` chips. They never grant permission.
- `enabled_tool_ids` are concrete built-in tools. They grant only the ability to request a tool; actual execution still follows permission mode and approval policy.
- Runtime is separate from tools. `claude_code`, `codex`, and future runtimes are invalid inside `enabled_tool_ids`.
- P1 has no user-defined custom tools. Use the built-in catalog only.
- Do not compatibility-map old abstract values. Rows containing old values must fail visibly or be reset/reseeded.
- Concrete tool IDs:
  - `file_read`
  - `file_write`
  - `shell`
  - `git_cli`
  - `web_search`
  - `web_fetch`
  - `browser_preview`
  - `diff_apply`
  - `artifact_store`
  - `publish_service`
  - `ppt_master`

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| `enabled_tool_ids` contains old abstract value `git`/`artifact`/`publish`/`ppt_generation` | `400 未知工具：<id>` |
| `enabled_tool_ids` contains runtime value `claude_code`/`codex`/`opencode` | `400 Runtime 不是工具：<id>` |
| `capability_tags` contains `#前端` | Store as `前端`; render as `#前端` |
| Agent lacks required concrete tool | Fail closed with a Chinese error naming the missing tool |
| Existing DB contains old columns or old values | Reset/reseed to new schema; do not silently map |

### 5. Good/Base/Bad Cases

- Good: A frontend Agent has `capability_tags=["前端","UI"]`, `enabled_tool_ids=["file_read","file_write","browser_preview"]`, `runtime_type="claude_code"`.
- Base: A planner Agent has `capability_tags=["规划","协调"]`, `enabled_tool_ids=["file_read","web_search","artifact_store"]`.
- Bad: `capability_tags=["runtime:codex"]` or `enabled_tool_ids=["codex"]`.
- Bad: `enabled_tool_ids=["git","artifact","publish"]` passes action checks.

### 6. Tests Required

- Shared/domain tests: catalog IDs and tag normalization.
- API tests: catalog response, draft output, create/update persistence, invalid abstract tool rejection, runtime-as-tool rejection.
- Dispatch tests: shell -> `shell`, Git -> `git_cli`, diff -> `diff_apply`, artifact -> `artifact_store`, publish -> `publish_service`, PPT -> `ppt_master`.
- UI/E2E tests: tags render as colored `#xxx`; tools render separately from Runtime on Web and read back consistently on Mobile/Desktop.

### 7. Wrong vs Correct

#### Wrong

- `capabilities=["前端","runtime:codex"]` and `toolset_ids=["git","artifact","publish"]`.

#### Correct

- `capability_tags=["前端","UI"]`, `runtime_type="codex"`, and concrete `enabled_tool_ids`.
