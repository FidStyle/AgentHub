---
name: agenthub-opencli-uat
description: Use opencli to verify AgentHub Web, Browser, and Electron acceptance flows with reusable browser state, screenshots, and explicit human handoff for login or sensitive permissions.
---

# AgentHub opencli UAT

Use this skill when testing AgentHub Web/Electron acceptance flows, especially GitHub login, browser state reuse, Desktop connector, and final UAT screenshots.

## Principles

- Prefer `opencli browser` for Web/PWA browser control, DOM state, element discovery, screenshots, and login-state reuse.
- Prefer Electron/desktop automation through opencli app adapters when available; otherwise use Playwright Electron with a real `DESKTOP_APP_PATH` or development main entry.
- Never collect credentials, tokens, 2FA codes, or private account data. If the flow reaches login, OAuth consent, permissions, payment, destructive action, or another sensitive boundary, stop and ask the user to complete that step manually.
- Do not replace product behavior with screenshots. Screenshots are evidence only after the real API/DB/runtime path has been exercised.

## Web Browser Flow

1. Inspect opencli health:

   ```bash
   opencli doctor
   opencli browser agenthub state
   ```

2. Open or reuse the Web session:

   ```bash
   opencli browser agenthub open http://localhost:3000
   opencli browser agenthub state
   ```

3. Find targets before clicking:

   ```bash
   opencli browser agenthub find "新建工作区"
   opencli browser agenthub eval '({ dpr: window.devicePixelRatio, width: innerWidth, height: innerHeight })'
   ```

4. Save raw screenshots under `e2e/artifacts/opencli-uat/` or the task-specific artifact folder:

   ```bash
   opencli browser agenthub screenshot e2e/artifacts/opencli-uat/web-workspace.png
   ```

5. If GitHub login is required, navigate to the login start page and pause. The user completes GitHub login in the browser. Resume with `state` and verify the app returns to AgentHub.

## Electron Flow

- `DESKTOP_APP_PATH` means the path automation passes to Electron launch. It can be a built app bundle/main entry or the development main JS, depending on the test.
- Before using a built app path, verify it exists and matches the current code build.
- If opencli has an Electron/app adapter available for the current AgentHub window, use it for state/screenshot; otherwise use Playwright Electron and save screenshots to the same artifact folder.
- Electron auth must be explicit device binding or CLI/runtime auth detection. Do not assume external browser cookies are visible to the renderer.

## Runtime Acceptance Checks

For each Web or Electron run, capture both UI evidence and behavioral evidence:

- Browser/Electron screenshot showing the entry and result.
- Network/API or DB evidence that messages/runtime logs/artifacts were created.
- Runtime mode: `cloud` or `local_desktop`.
- Executor mode: real CLI, real remote worker, or blocked with explicit reason.
- If blocked by login/CLI credentials, record the exact user action needed and stop.

## Failure Handling

- Missing opencli capability: report the missing command and fall back only after user approval or clear project contract allowance.
- Login/permission barrier: stop for user action.
- Runtime unavailable: verify the UI shows a Chinese blocked/error state and that no fake agent success message is persisted.
