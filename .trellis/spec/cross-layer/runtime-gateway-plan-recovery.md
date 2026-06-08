# Runtime Gateway Plan Recovery Contract

## Scenario: Native Session Resume And Plan Recovery

### 1. Scope / Trigger

- Trigger: modifying native runtime session IDs, plan progress recovery, retry/resume, or terminal reconciliation.

### 2. Signatures

- `runtime_sessions.native_session_id`
- `plan_node_attempts.runtime_session_id`
- `agent_mailbox_items.status`
- `POST /api/plan-nodes/:id/resume|retry`

### 3. Contracts

- Native session IDs are evidence and resume handles; persist them when runtime returns them.
- Retry/resume must supersede old active attempts/mailbox rows.
- Terminal runtime events must reconcile plan node status and queue leftovers.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Runtime terminal event arrives | plan attempt/mailbox reaches matching terminal state |
| Retry old failed node | new attempt links previous attempt |
| Native session ID missing | resume unavailable is explicit |

### 5. Good/Base/Bad Cases

- Good: Runtime completes, plan node completes, stale queue rows close.
- Bad: Resume starts a second active mailbox for the same node.

### 6. Tests Required

- Native session persistence test.
- Retry/resume superseding test.
- Terminal reconciliation test.

### 7. Wrong vs Correct

#### Wrong

- Create new retry work while old waiting row remains active.

#### Correct

- Cancel/supersede old active rows before inserting retry work.
