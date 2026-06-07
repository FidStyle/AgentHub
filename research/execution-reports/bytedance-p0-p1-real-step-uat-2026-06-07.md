# Bytedance P0/P1 real-step UAT report

Date: 2026-06-07

Task: `.trellis/tasks/06-07-uat-bytedance-p0-p1`

Scope: user-requested fresh, real, step-by-step UAT for Bytedance P0/P1. This report does not reuse historical pass conclusions.

## Result

FAIL. The current product state does not pass full real user-flow acceptance.

Fresh blockers found:

- Root Web entry `http://localhost:3000/` renders a Next.js runtime error overlay: `Cannot read properties of undefined (reading 'call')`.
- Fresh full-control single-prompt run failed: `REAL-STEP-UAT-1780819586-FULL`, 35 passed / 23 failed / 0 warned.
- `/api/chat` SSE emitted `endpoint_unavailable`: `Runtime 执行器未就绪，节点未投递。`
- Durable plan exists but `plans.status = failed`; all 4 plan nodes are `failed`.
- No `runtime_sessions` rows were created.
- Required product files and artifact were not generated.
- Web workspace route opens, but the session list is empty and chat panel shows `加载失败 / 数据获取失败` while API returns the session and messages.
- Mobile/PWA same-session route opens, but shows `暂无消息` while API returns 4 messages and a failed timeline.
- No AgentHub/Electron OpenCLI adapter is present in `opencli list`; Desktop cannot be counted as fresh OpenCLI pass.

## Fresh Run IDs

| Item | Value |
| --- | --- |
| Strict/API run marker | `REAL-STEP-UAT-1780819586-FULL` |
| Workspace | `54438af5-cae7-4962-89cb-d95d2eb51a40` |
| Session | `aa86c8e0-b539-4ac8-ae52-ebeaece8875e` |
| Plan | `36f17ce6-ddfb-4484-b533-4535a5aa5b7e` |
| Workspace root | `/Users/joytion/.agenthub/cloud-workspaces/user/strict-product-real-step-uat-1780819586-full-54438af5` |
| Strict evidence dir | `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-STEP-UAT-1780819586-FULL/` |

## Step-by-step UAT

| Step | Action | State verification | Result |
| --- | --- | --- | --- |
| 1 | Restarted Web dev server and opened `http://localhost:3000/` through OpenCLI | Browser DOM shows Next.js runtime error overlay; screenshot `bytedance-real-step-uat-root-error.png` | FAIL |
| 2 | Created fresh workspace/session through real API setup to continue downstream diagnosis | `POST /api/workspaces` and `POST /api/sessions` succeeded; workspace/session IDs listed above | PASS for setup only |
| 3 | Sent fixed prompt through real `POST /api/chat` with `permissionMode=full_control` | SSE completed but emitted `endpoint_unavailable` and `runtime_failed`; no `approval_requested` | FAIL |
| 4 | Checked durable plan state | `plans.status = failed`; all 4 plan nodes failed | FAIL |
| 5 | Checked runtime state | `runtime_sessions` count was 0; no node execution was persisted | FAIL |
| 6 | Checked generated product files | Only `README.md` exists; missing `package.json`, `src/server.js`, `public/index.html`, `public/app.js`, CSS | FAIL |
| 7 | Checked artifact semantics | No final artifact row; no recommendation/confirmation metadata | FAIL |
| 8 | Opened Web workspace route through OpenCLI | Workspace shell loads, but session list shows empty; chat panel shows `加载失败 / 数据获取失败`; screenshot `bytedance-real-step-uat-workspace-failed-readback.png` | FAIL |
| 9 | Checked Web API readback for same session | `GET /api/messages?session_id=...` returns 4 messages with statuses `思考中 / 执行中 / 执行失败`; timeline returns 11 items including failed plan | API PASS, UI FAIL |
| 10 | Opened Mobile/PWA same-session route | `/m/sessions/aa86...` loads but shows `暂无消息`; screenshot `bytedance-real-step-uat-mobile-failed-readback.png` | FAIL |
| 11 | Tried Web UI `新建会话` on workspace page | Real click succeeded, but UI remained empty and no new selected session appeared; API still reported only the existing strict session; screenshot `bytedance-real-step-uat-web-new-session-noop.png` | FAIL |
| 12 | Checked Desktop/Electron OpenCLI availability | `opencli list` contains no AgentHub/Electron adapter | NOT RUN / BLOCKED |
| 13 | Manual allow/reject branches | Not executed in this fresh UAT because the full-control main path failed before any permission card; Mobile `/m/approve` showed unrelated historical pending approvals | NOT RUN |

## API Evidence

`GET /api/messages?session_id=aa86c8e0-b539-4ac8-ae52-ebeaece8875e` returned:

- 4 messages.
- Message types: `text`, `plan_card`, `system_event`, `system_event`.
- Visible statuses: `思考中`, `执行中`, `执行失败`.

`GET /api/sessions/aa86c8e0-b539-4ac8-ae52-ebeaece8875e/timeline` returned:

- 11 items.
- Includes failed plan item for the fixed prompt.

## Evidence Files

| Evidence | Path |
| --- | --- |
| Root error screenshot | `e2e/artifacts/opencli-uat/bytedance-real-step-uat-root-error.png` |
| Web failed readback screenshot | `e2e/artifacts/opencli-uat/bytedance-real-step-uat-workspace-failed-readback.png` |
| Mobile failed readback screenshot | `e2e/artifacts/opencli-uat/bytedance-real-step-uat-mobile-failed-readback.png` |
| Web new-session no-op screenshot | `e2e/artifacts/opencli-uat/bytedance-real-step-uat-web-new-session-noop.png` |
| OpenCLI command list | `e2e/artifacts/opencli-uat/bytedance-real-step-uat-opencli-list.json` |
| Strict/API summary | `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-STEP-UAT-1780819586-FULL/summary.json` |
| SSE raw transcript | `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-STEP-UAT-1780819586-FULL/chat-sse.raw.txt` |
| DB messages snapshot | `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-STEP-UAT-1780819586-FULL/db-messages.json` |

## Conclusion

The previous `BYTEDANCE-P0-P1-FINAL-COMPLETION-GATE` pass is invalidated as the current final acceptance conclusion. The current state is failed, with P0 blockers in root Web entry, runtime executor availability, Web session readback, Mobile/PWA session readback, artifact generation, and fresh Desktop/Electron evidence.

## Required Next Fixes

1. Fix root Web runtime error before any product pass claim.
2. Fix `public_cloud` runtime executor readiness so full-control single-prompt delivery can dispatch nodes.
3. Fix Web workspace session list/chat panel readback so API-visible sessions/messages appear in UI.
4. Fix Mobile/PWA same-session message readback.
5. Provide fresh Desktop/Electron evidence through an available adapter or explicitly supported fallback with current-run evidence.
6. Re-run full real-step UAT including full-control, manual allow, and manual reject branches.
