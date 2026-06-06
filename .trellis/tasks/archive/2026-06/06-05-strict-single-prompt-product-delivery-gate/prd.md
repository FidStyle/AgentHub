# 严格单 prompt 产品交付回归通过

## Goal

实现并跑通一个严格的 fresh single-prompt 产品交付回归门禁。门禁必须从真实验收环境创建新的 workspace/session，发送一次 `做一个加减乘除的简单网站，使用sqlite存储历史记录` prompt，并只在真实 AgentHub 编排、权限模式、文件/代码引用、产物语义和三端读回证据齐全时通过。

## What I Already Know

- 用户明确要求测试非常严格：只有通过严格测试才算可行。
- 上一轮 `UNIFIED-PRODUCT-LINE-REGRESSION-2026-06-05` 已被撤销，因为它把历史 DB/文件/截图/生成物终态误判为当前一键交付通过。
- 当前修正后的 `apps/web/scripts/verify-unified-product-lines.ts` 已能让旧 fixed sample 失败，失败点包括 fresh run marker、full-control manual permission card、artifact recommendation/confirmation。
- `/api/chat` 真实链路支持：
  - 创建 durable plan / plan_nodes / attempts / mailbox；
  - `permissionMode` 透传到 runtime worker；
  - full-control/auto 可在 worker 中 auto approve native tool action；
  - runtime output、permission parts、handoff metadata 可落 `messages.metadata`。
- 验收环境入口为 `pnpm env:acceptance:up`、`pnpm dev:acceptance`、`pnpm env:acceptance:smoke`，认证使用 `docker/.acceptance.env` 中的 `TEST_AUTH_COOKIE`。

## Requirements

1. 新增或升级严格验证脚本，必须创建 fresh workspace/session，不允许依赖固定历史 IDs。
2. 验证脚本必须通过真实 HTTP/API/SSE 发送一次 prompt，不能直接写 DB 造成功状态。
3. 验证脚本必须生成唯一 run marker，并在 user message、report/evidence 或 metadata 中可追踪。
4. A 线 Full-Auto Product Delivery 必须验证：
   - Orchestrator/架构师首响或等价可见 planning 证据；
   - 前端工程师和后端/storage 工作被分配；
   - plan/nodes/attempts/mailbox/runtime_sessions 真实完成，无 terminal queue leftover；
   - 消息流包含可见开发过程、文件/代码引用和最终完成状态；
   - 生成 calculator 文件、API、UI 和 SQLite history 真实可运行。
5. B 线 Permission Lifecycle 必须验证：
   - full-control 下允许范围内没有 pending manual permission card；
   - auto-approved actions 有 continuation/terminal evidence；
   - manual allow/reject 仍由旧专线或同脚本独立覆盖，原权限卡状态必须迁移。
6. C 线 Workbench / Artifact 必须验证：
   - 不能把全部文件默认算产物；
   - 必须存在模型推荐 + 用户确认/指定的产物语义；
   - 至少有可读回的最终产物候选，例如 `public/index.html` 静态入口、manifest 或 artifact row。
7. D 线 Tri-Surface State 必须验证：
   - Web 真实会话读回；
   - Mobile/PWA 同 session 读回；
   - Desktop/Electron 有 OpenCLI adapter 时使用 adapter，否则按项目合同使用 Playwright Electron fallback 并记录原因。
8. 旧历史 fixed sample 只能作为回归对照，不得作为 strict gate pass 来源。

## Acceptance Criteria

- [ ] 严格验证脚本能在当前验收环境中创建 fresh run，并输出 workspaceId/sessionId/planId/runMarker/evidenceDir。
- [ ] 脚本在完整证据齐全时 exit 0；任一严格条件缺失时 exit 1，并列出明确失败项。
- [ ] 脚本通过真实 `/api/chat` 单 prompt 触发编排，不直接写 DB 完成态。
- [ ] 脚本验证 calculator `+ - * /`、除零、非法输入和 SQLite history。
- [ ] 脚本验证 full-control 权限不出现 pending manual permission card，并验证自动续跑 evidence。
- [ ] 脚本验证 artifact recommendation/confirmation 或用户 designation 语义。
- [ ] Web/Mobile/Desktop 或 fallback 证据写入 task-specific artifact 目录。
- [ ] `pnpm --filter @agenthub/web type-check`、Trellis validate、`git diff --check` 通过。
- [ ] 自动提交、归档、记录 journal。

## Out of Scope

- 不做最终 Demo 包和 3 分钟素材。
- 不启动未开始的纯 P2。
- 不实现 Docker/package 正式发布 bundle；本任务只需要能严格表示并验证当前可交付的前端产物候选。

## Technical Notes

- 关键脚本参考：`apps/web/scripts/verify-unified-product-lines.ts`、`apps/web/scripts/verify-complete-multi-agent-phase5.ts`、`apps/web/scripts/verify-acceptance-chat-api.ts`。
- 关键路径：`apps/web/app/api/chat/route.ts`、`apps/web/server/runtime-worker.ts`、`apps/web/lib/orchestrator/action-dispatcher.ts`。
- 关键规范：`.trellis/spec/cross-layer/real-flow-acceptance.md`、`.trellis/spec/guides/end-to-end-contract-planning.md`、`.trellis/spec/backend/runtime-workspace-contract.md`、`.trellis/spec/frontend/quality-guidelines.md`。
