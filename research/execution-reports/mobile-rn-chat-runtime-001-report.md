# Execution Report · MOBILE-RN-CHAT-RUNTIME-001

- **任务**: 修复 PRODUCT-REALITY-GAP-AUDIT-001 的 PRGA-001 —— 原生 `apps/mobile` ChatScreen 发送消息 `setTimeout` 回显假交互。
- **关联回归**: REG-20260531-010（PRGA-001 partial close）
- **绑定 FR**: FR-MOBILE-001, FR-CHAT-001, FR-RUNTIME-001
- **Ralph session**: `ralph-20260531-053429`（analyze→plan→execute→verify→[post-verify]→review→[post-review]→goal-audit→milestone-complete）
- **日期**: 2026-05-31

## 问题（修复前）
`apps/mobile/src/screens/ChatScreen.tsx:13-50` 的 `handleSend`：纯 local state，硬编码 `session_id='mobile-sess-1'`，`setTimeout(500ms)` 推入 `[Agent] 收到: "<原文>"` 回显，**无任何网络请求** —— 命中红线「发送只显示到列表 + 无真实链路」。

## 参考链路
- 后端契约 `apps/web/app/api/chat/route.ts`：`POST {sessionId,content,roleAgentId?,mentions?}`，`requireAuth`（session cookie），返回 `text/event-stream`（`RuntimeGatewayEvent`）。
- PWA 消费 `apps/web/app/m/sessions/[sessionId]/page.tsx`：`fetch('/api/chat')` + `res.body.getReader()` 增量解析 `data: {json}\n\n`，累积 delta，终端态映射通知。

## 根因（原生 RN 与 PWA 差异）
1. 原生无同源、无 cookie session、无 auth 注入 → 必须显式 API base + token；当前 mobile 包无任何 config/client。
2. RN `fetch` 无 `res.body.getReader()` → SSE 须用 `XMLHttpRequest` 增量 `responseText` 解析。
3. 硬编码 session 必须移除；真实 session 来自配置注入，原生环境暂缺 → 禁用发送 + 明确引导。

## 改动
| 文件 | 改动 |
|------|------|
| `apps/mobile/src/lib/config.ts` (new) | `getRuntimeConfig` 读 `EXPO_PUBLIC_API_BASE_URL`/`EXPO_PUBLIC_SESSION_ID`/`EXPO_PUBLIC_AUTH_TOKEN`；任一缺失 → `configured=false` + `missing[]` |
| `apps/mobile/src/lib/chatClient.ts` (new) | `sendChat` 用 XHR POST `{base}/api/chat` + `Authorization: Bearer`，增量解析 SSE `RuntimeGatewayEvent`，累积 `runtime_output.delta` 为单条回复，终端态（`endpoint_unavailable`/`local_runtime_offline`/`tunnel_disconnected`/`runtime_failed`）映射中文通知，HTTP 非 2xx → `onError`，无 `setTimeout`/echo |
| `apps/mobile/src/screens/ChatScreen.tsx` | 删除假交互；`configured=false` → 禁用发送+输入+中文配置/登录引导错误态；`configured=true` → 调 `sendChat` 流式渲染 agent 回复 + system 通知 + error 错误态，发送中禁用，会话内真实消息保留 |
| `apps/mobile/package.json` | + `test`(vitest run) + `vitest` devDep |
| `apps/mobile/src/lib/__tests__/chatClient.test.ts` (new) | 5 tests 覆盖三路径 |

## 验收证据
- **fresh test**（2026-05-31 05:44）：`cd apps/mobile && pnpm test` → **Test Files 1 passed (1), Tests 5 passed (5)**
  - ① 无 echo：`onDelta` 仅来自真实 `runtime_output`，断言 `send` POST `sessionId:'sess-real'`/`content`（非硬编码）
  - ② 成功路径：deltas 累积为 `'Hello World'` 单条 reply，零通知
  - ③ 失败路径：HTTP 503 → `onError` 中文错误、`reply=''`
  - ③b：`runtime_failed` 终端事件 → 中文通知、`reply=''`
  - config 缺 env → `configured=false`、`missing` 含 `EXPO_PUBLIC_API_BASE_URL`
- `pnpm --filter @agenthub/shared build` → ESM + DTS Build success
- 反假交互扫描：`grep -nE "setTimeout|mobile-sess-1|收到:" ChatScreen.tsx` → CLEAN

## DEFERRED / Out-of-scope
- 真实设备/模拟器 GUI 截图：CLI 环境无 Metro/GUI（与 REG-20260531-010 现有 DEFERRED 一致），逻辑层链路已由 vitest 覆盖。
- 跨端真实消息持久拉取（GET /api/messages）：out-of-scope，受同一 auth 缺口限制。

## 结论
PRGA-001 代码级闭环：原生 Mobile 聊天不再本地伪造回复，发送走真实 `/api/chat` runtime 链路，无配置显式禁用 + 引导，失败显式错误态。REG-20260531-010 PRGA-001 **partial close**；仅剩 PRGA-004（Web 编排 UI）。
