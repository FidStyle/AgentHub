# Runtime Gateway Role Runtime Contract

## Scenario: Role Runtime Binding And Handoff

### 1. Scope / Trigger

- Trigger: modifying Role Agent runtime config, Orchestrator role dispatch, or runtime prompt construction.

### 2. Signatures

- `role_agents.runtime_type`: `claude_code | codex`
- Runtime dispatch role: `{ id, name, system_prompt, runtime_type }`
- Handoff metadata: role IDs, upstream node/message refs, artifact/file refs.

### 3. Contracts

- Runtime type is a binding, not a tool and not a tag.
- Downstream roles receive structured handoff context.
- User-visible role names are Role Agents, not runtime product names.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Tag says `runtime:codex` | ignored/rejected by Role Agent API |
| Role runtime is `codex` | dispatch uses Codex runtime |
| Handoff missing | downstream node must fail or include visible missing-context reason |

### 5. Good/Base/Bad Cases

- Good: Frontend role uses its configured runtime and receives backend API handoff.
- Bad: UI sends to "Codex" as the conversation participant.

### 6. Tests Required

- API tests rejecting runtime tags.
- Dispatch tests for runtime type source.
- Handoff metadata persistence/readback tests.

### 7. Wrong vs Correct

#### Wrong

- Choose runtime by capability tag or enabled tool.

#### Correct

- Choose runtime from `role_agents.runtime_type` only.
