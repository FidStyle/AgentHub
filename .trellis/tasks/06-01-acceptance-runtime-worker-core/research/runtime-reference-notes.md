# Runtime / Transport Reference Notes

## codeg

- `refer_proj/codeg/src/lib/transport/remote-desktop-transport.ts` uses a `Transport` interface so the UI calls `call/subscribe/eventStream` without knowing whether the backend is Tauri invoke, HTTP, WebSocket, or remote desktop.
- Remote desktop mode routes HTTP and WS through Rust proxy commands instead of connecting from the webview directly.
- It treats `__ready__`, disconnect, unauthorized, and reconnect as first-class lifecycle events with bounded wait time.

AgentHub takeaway: Web/Mobile must not target Desktop directly. `user_local` should keep routing through Gateway/DeviceChannel and must track request lifecycle explicitly.

## AionUi

- `docs/prds/conversations/remote/remote-agent.md` describes Remote Agent CRUD, connection test, pairing/handshake, streaming response, tool calls, permissions, and connection state as one product surface.
- `packages/desktop/src/renderer/pages/settings/AgentSettings/LocalAgents.tsx` separates detected local agents from custom agents and refreshes state after create/update/delete.

AgentHub takeaway: built-in/local agents need enough visible status and capability metadata so `@角色` can be backed by a real runtime, not just a display name.

## lobehub

- `apps/desktop/src/main/controllers/GatewayConnectionCtr.ts` wires GatewayConnectionService to local controllers.
- It routes `AgentRunRequestMessage` to `HeterogeneousAgentCtr.startSession/sendPrompt`.
- It routes tool calls to LocalFile/ShellCommand controllers via a method map and returns explicit unsupported-tool errors.

AgentHub takeaway: Desktop main should be the runtime/tool boundary. Gateway should send typed requests, maintain request IDs, and map Desktop events back to runtime sessions.
