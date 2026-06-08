# Real Flow Product Delivery Contract

## Scenario: One Prompt To Frontend-Visible Product

### 1. Scope / Trigger

- Trigger: claiming a user can send one prompt and receive a generated runnable product under full-control permission mode.

### 2. Signatures

- `POST /api/chat` with `permissionMode="full_control"` or `"dangerous_bypass"`.
- Durable readback: messages, plans, plan nodes, attempts, mailbox items, actions, runtime sessions/logs, artifacts, workspace files, Git state.

### 3. Contracts

- Orchestrator allocation, assigned role replies, role handoff, Orchestrator validation, and artifact recommendation must appear in the central IM transcript.
- Full-control mode continues until durable `completed` or durable visible `failed/interrupted`.
- The canonical Bytedance product prompt `做一个加减乘除的简单网站，使用sqlite存储历史记录` counts as full product-delivery intent when `permissionMode` is `full_control` or `dangerous_bypass`; do not require extra magic words such as `全自动` or `交付产物` before creating the final artifact recommendation.
- `permissionMode="auto"` is not full-control. It may continue planning, but native CLI side effects still require a visible permission card and manual allow/reject before completion.
- After a completed full-control product plan, create exactly one final product candidate artifact row and one `result_card` message with both `artifactRecommendation` and `artifactConfirmation` metadata. The primary source is the architect summarizing node's delivery manifest: `.agenthub/delivery.json` plus `.agenthub/start.sh`. Candidate fallback selection is only for compatibility: static browser entry (`public/index.html`, `index.html`, `dist/index.html`, `build/index.html`, `out/index.html`), then runnable service/package candidate from `package.json` scripts (`start`, `dev`, `preview`, `serve`). The confirmation source is the full-control product-delivery flow, not a claim that the user explicitly typed artifact-confirmation wording.
- Runnable service artifacts must be publishable through an architect-authored or system-generated launch script. For full-control delivery, the architect summarizing node should select the final product and write `.agenthub/start.sh` using `PORT="${PORT:-3000}"`, then write `.agenthub/delivery.json` with `title`, `source_path`, `artifact_type`, `start_command`, and `description`. Do not require generated products to store static files when the correct user-facing entry is a startup script, backend service, full-stack script, or `npm run ...`.
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
| Architect writes `.agenthub/delivery.json` and `.agenthub/start.sh` | Use that manifest as the artifact source before scanning static/package fallbacks |
| Completed full-control product prompt has no static entry and no runnable package script | Fail visibly with missing artifact entry guidance; do not claim completion |
| Canonical calculator prompt completes but has no final artifact row/result card | Fail the gate; fix `/api/chat` delivery-intent/artifact recommendation instead of relaxing the verifier |
| Final artifact recommendation creates multiple file-tree artifacts | Fail; recommend the browser entry candidate only unless the user explicitly designates more |

### 5. Good/Base/Bad Cases

- Good: Calculator sample shows IM process, creates files, passes browser calculation, persists SQLite history, and recommends one artifact.
- Base: Canonical calculator prompt + `permissionMode="full_control"` produces a central IM `result_card` whose metadata contains `artifactRecommendation` and `artifactConfirmation`; static products usually point to `public/index.html`, while service-only products may point to `package.json` plus package-script metadata.
- Bad: Chat only shows user prompt, permission cards, and final "已发布".
- Bad: The final artifact only appears when the user appends `全自动完成直到交付产物`.
- Bad: The final artifact gate fails solely because `public/index.html` is absent even though `package.json` exposes a working start/dev/preview/serve script.
- Bad: The system chooses a product entry by hardcoded path even though the architect summarizing node produced a different delivery manifest.

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
