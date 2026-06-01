# Web Workspace Runtime Fix 验收记录

日期：2026-06-01

## 覆盖范围

- Web 云端对话默认 `Orchestrator`。
- SSE 动态输出：真实 Codex worker，经 Redis/Gateway 返回多个 `runtime_output`。
- Markdown 渲染：agent 回复 `**通过**` 刷新后显示为 Markdown 结果。
- 权限预设：进入 `messages.metadata.permissionMode`，不再拼接到用户正文。
- 多角色：`Frontend Engineer` + `Backend Engineer` 可同时写入 mentions/roleAgents metadata。
- 附件：浏览器 FormData 上传，唯一 token 被 runtime 读取并回复。
- Artifact：`<agenthub-artifact>` 被解析为持久化 artifact message。
- 云端工作区：创建时生成 Git 项目目录，文件树 API/UI 可查看 `README.md`。
- 工作区删除：DELETE API 返回 200，列表中移除目标工作区。
- 布局：1466x786 下三列独立，body 无横向滚动，composer 贴底。
- Mobile/PWA：`/m/sessions/:sessionId` 可读取同一真实会话回复。

## 关键证据

- Web build：`NEXT_TELEMETRY_DISABLED=1 pnpm --filter @agenthub/web build`，exit 0。
- Web tests：`pnpm --filter @agenthub/web test`，120 passed。
- Desktop build：`pnpm --filter @agenthub/desktop build`，exit 0。
- Desktop tests：`pnpm --filter @agenthub/desktop test`，22 passed。
- Codex CLI smoke：`codex exec --json -s read-only --color never '请只回复 AGENTHUB_CODEX_SMOKE_OK'`，exit 0。
- Runtime startup used:
  - `REDIS_URL=redis://localhost:6379 pnpm --filter @agenthub/web start`
  - `REDIS_URL=redis://localhost:6379 RUNTIME_EXECUTOR=real RUNTIME_CLI=codex pnpm --filter @agenthub/web exec tsx server/runtime-worker.ts`
- SSE sample: `UAT_DYNAMIC_1780317100` arrived across 3 `runtime_output` frames.
- Screenshot: `e2e/artifacts/opencli-uat/current-fixes/web-three-column-chat.png`。

## 残留风险

- opencli `fill/type` did not update React controlled input state reliably in this browser session, so the runtime send assertion used browser `fetch('/api/chat')` with the same authenticated browser cookies. Manual typing in the UI still needs a human smoke check.
- Desktop Electron visual opencli run was not repeated in this slice; desktop package build/test passed and local runtime surfaces were not modified.
