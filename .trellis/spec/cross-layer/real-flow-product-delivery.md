# Real Flow Product Delivery Contract

## Scenario: One Prompt To Frontend-Visible Product

### 1. Scope / Trigger

- Trigger: claiming a user can send one prompt and receive a generated runnable product under automatic/full-control permission mode.

### 2. Signatures

- `POST /api/chat` with `permissionMode="auto" | "full_control"`.
- Durable readback: messages, plans, plan nodes, attempts, mailbox items, actions, runtime sessions/logs, artifacts, workspace files, Git state.

### 3. Contracts

- Orchestrator allocation, assigned role replies, role handoff, Orchestrator validation, and artifact recommendation must appear in the central IM transcript.
- Full-control mode continues until durable `completed` or durable visible `failed/interrupted`.
- Backend correctness is insufficient; frontend files must be visible and browser-exercised.
- Product tests run from the generated workspace. Dependencies, DB files, logs, and cleanup stay inside that workspace.
- Completion cannot be derived from assistant text alone.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Frontend node waiting/missing | overall state remains partial/running, not completed |
| Full-control native tool request allowed by policy | auto-approve and continue |
| Manual reject | action rejected; no side effect; wait for next user input |
| SQLite/history required | UI/API/DB proves persistence after reload/readback |

### 5. Good/Base/Bad Cases

- Good: Calculator sample shows IM process, creates files, passes browser calculation, persists SQLite history, and recommends one artifact.
- Bad: Chat only shows user prompt, permission cards, and final "已发布".

### 6. Tests Required

- Fresh one-prompt run with unique marker.
- Browser UI behavior assertions for the generated product.
- Workspace file/Git/artifact readback.
- Web, Mobile/PWA, and Desktop/Electron evidence when claiming three-surface pass.

### 7. Wrong vs Correct

#### Wrong

- Mark complete because backend API unit tests passed.

#### Correct

- Mark complete only after IM process, frontend product, browser behavior, DB persistence, and artifact recommendation pass.
