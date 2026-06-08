# Real Flow Governance Gate Contract

## Scenario: Acceptance Evidence Governance

### 1. Scope / Trigger

- Trigger: writing an acceptance report, tracker update, or completion claim for P0/P1 flows.

### 2. Signatures

- `bash scripts/verify-governance-gate.sh <TASK-ID>`
- Report fields: fresh marker, session/workspace IDs, commands, surface status, residual risk.

### 3. Contracts

- Governance status is not completion by itself; it checks that evidence is present and coherent.
- Reports must distinguish passed, blocked, skipped, fallback, and not-run.
- Mock/fixture tests can support components but cannot satisfy the main product flow.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Missing tracker/report/commit/evidence | no completion claim |
| Script fails | no completion claim |
| Skipped surface counted as pass | reject report |

### 5. Good/Base/Bad Cases

- Good: Report includes fresh run IDs, real commands, screenshots/API evidence, and governance exit 0.
- Bad: `status.json completed` is treated as product completion.

### 6. Tests Required

- Run governance script for the task ID.
- Audit report for pass/fail consistency.

### 7. Wrong vs Correct

#### Wrong

- Maestro status is completed, therefore project is done.

#### Correct

- Evidence passes, tracker/report are updated, governance exits 0, and residual risk is explicit.
