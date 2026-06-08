# Real Flow Acceptance Contract

This file is the short entry point for AgentHub real-flow acceptance. Keep detailed product narrative in `research/`; keep executable acceptance rules in the small scenario specs below.

## Read These Scenario Specs

| Scenario | Spec |
| --- | --- |
| Local/cloud chat, role dispatch, attachments, artifacts | `real-flow-chat-runtime.md` |
| Plan node, mailbox, runtime terminal consistency | `real-flow-queue-consistency.md` |
| One prompt to visible frontend product delivery | `real-flow-product-delivery.md` |
| Bytedance P0/P1 final real-step UAT | `real-flow-bytedance-uat.md` |
| Evidence governance and fake-pass rejection | `real-flow-governance-gate.md` |

## Global Acceptance Rules

- A P0/P1 user flow passes only through real UI/API/DB/runtime state. Mock routes, file-existence checks, historical screenshots, and `playwright --list` do not count.
- Completion must be durable: reload or API readback must show the same session, messages, plan/action/runtime state, and artifact refs.
- Web, Mobile/PWA, and Desktop/Electron may have different UI density, but must share state names, permission semantics, and failure reasons.
- Any `partial`, `blocked`, `not-run`, `failed`, skipped surface, or missing readback means the whole final gate is not complete.
- Runtime unavailable states must fail visibly. Never emit a fake assistant success response to hide unavailable local/remote runtime.

## Tests Required

- API/DB assertions for durable rows and owner checks.
- Browser-level UI assertions for the actual user path.
- Refresh/readback assertions for messages, approvals, artifacts, and plan state.
- Three-surface evidence when the report claims Bytedance P0/P1 final completion.
