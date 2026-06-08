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
- The canonical Bytedance product prompt `做一个加减乘除的简单网站，使用sqlite存储历史记录` counts as full product-delivery intent when `permissionMode` is `auto` or `full_control`; do not require extra magic words such as `全自动` or `交付产物` before creating the final artifact recommendation.
- After a completed full-control product plan, if `public/index.html` exists, create exactly one final product candidate artifact row for that path and one `result_card` message with both `artifactRecommendation` and `artifactConfirmation` metadata. The confirmation source is the full-control product-delivery flow, not a claim that the user explicitly typed artifact-confirmation wording.
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
| Canonical calculator prompt completes but has no final artifact row/result card | Fail the gate; fix `/api/chat` delivery-intent/artifact recommendation instead of relaxing the verifier |
| Final artifact recommendation creates multiple file-tree artifacts | Fail; recommend the browser entry candidate only unless the user explicitly designates more |

### 5. Good/Base/Bad Cases

- Good: Calculator sample shows IM process, creates files, passes browser calculation, persists SQLite history, and recommends one artifact.
- Base: Canonical calculator prompt + `permissionMode="full_control"` produces `artifacts.source_path="public/index.html"` and a central IM `result_card` whose metadata contains `artifactRecommendation` and `artifactConfirmation`.
- Bad: Chat only shows user prompt, permission cards, and final "已发布".
- Bad: The final artifact only appears when the user appends `全自动完成直到交付产物`.

### 6. Tests Required

- Fresh one-prompt run with unique marker.
- Browser UI behavior assertions for the generated product.
- Workspace file/Git/artifact readback.
- API/unit regression: canonical calculator prompt under full-control persists the final artifact row and result-card metadata.
- Web, Mobile/PWA, and Desktop/Electron evidence when claiming three-surface pass.

### 7. Wrong vs Correct

#### Wrong

- Mark complete because backend API unit tests passed.

#### Correct

- Mark complete only after IM process, frontend product, browser behavior, DB persistence, and artifact recommendation pass.
