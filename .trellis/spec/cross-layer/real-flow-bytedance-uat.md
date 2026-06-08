# Bytedance Real-Step UAT Contract

## Scenario: Bytedance P0/P1 Final Real-Step UAT

### 1. Scope / Trigger

- Trigger: user asks for Bytedance 全真实验收, 最终验收, P0/P1 全部完成, 模拟用户全流程, or does not trust historical pass.

### 2. Signatures

- Use a fresh session, fresh workspace, fresh marker, and current UI/API paths.
- Record session ID, workspace ID, HTTP route/base URL, artifact IDs, and evidence directory.

### 3. Contracts

- Do not reuse historical pass as final acceptance.
- Verify each step before taking the next user action.
- Cover full-control, manual allow, manual reject, Git/file/code/artifact/publish readback, and three surfaces.
- Fail closed: any P0/P1 partial/blocked/not-run/failed item means final result is not complete.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Historical evidence only | not accepted |
| One surface missing | not final pass |
| Permission path skipped | not final pass |
| Fake/mock runtime success | not final pass |

### 5. Good/Base/Bad Cases

- Good: Fresh marker run proves IM, permission, Git/file/artifact/publish, and Web/Mobile/Desktop readback.
- Bad: Report lists old screenshots without a fresh session.

### 6. Tests Required

- OpenCLI real-browser UAT for user-visible paths.
- Playwright/API/DB tests for deterministic assertions.
- Evidence report with per-step pass/fail table.

### 7. Wrong vs Correct

#### Wrong

- Use previous strict run as today's final pass.

#### Correct

- Create a new workspace/session and verify every required step from the UI.
