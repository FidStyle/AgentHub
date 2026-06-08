# Runtime Gateway Contract

Runtime Gateway specs are split by responsibility. This file is only the index and global invariant.

## Scenario Specs

| Scenario | Spec |
| --- | --- |
| Gateway routing and endpoint selection | `runtime-gateway-routing.md` |
| Worker liveness, queue, runtime logs | `runtime-gateway-worker.md` |
| Role runtime binding and handoff context | `runtime-gateway-role-runtime.md` |
| Native session resume and plan recovery | `runtime-gateway-plan-recovery.md` |

## Global Contracts

- Runtime execution must route through the selected workspace execution domain: `public_cloud` or `user_local`.
- Runtime type comes from `role_agents.runtime_type`, not tags or tools.
- Gateway unavailable states are explicit failures, not successful assistant messages.
- Runtime jobs must write durable `runtime_sessions` and `runtime_logs` when execution is attempted.
- Root-cause fixes only: do not patch markdown, runtime, or session bugs by hiding symptoms in UI.

## Tests Required

- Endpoint selection tests for cloud/local domains.
- Worker liveness tests for queue unavailable behavior.
- Role binding tests proving `runtime_type` wins over tags/tools.
- Plan recovery tests proving terminal state and native session refs are durable.
