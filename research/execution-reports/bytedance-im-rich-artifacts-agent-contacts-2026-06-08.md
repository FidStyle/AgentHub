# Bytedance IM 富媒体产物与 Agent 联系人补齐执行报告

日期：2026-06-08  
TASK-ID：BYTEDANCE-IM-RICH-ARTIFACTS-AGENT-CONTACTS-2026-06-08  
任务：`.trellis/tasks/06-08-bytedance-im-rich-artifacts-agent-contacts`  
合同/规格：`research/contracts/REMAINING-P1-FEATURES-2026-06-05.md`、`research/contracts/RICH-DOC-PPT-ARTIFACTS-2026-06-03.md`、`.trellis/spec/cross-layer/im-conversation-artifact-contract.md`

## 结论

本轮完成 IM 联系人/群聊、富媒体消息卡、Role Agent 工具集、自建 Agent 草稿、Diff 应用审批和 PPT artifact API 的实现补齐，并通过 Web 单测、类型检查、lint、Trellis context validate、diff check 和 fresh strict Bytedance IM-first 三端验收。

Fresh strict run `BYTEDANCE-IM-RICH-1780856710` 从真实 `POST /api/chat` 单 prompt 触发 Orchestrator 分工、前端/后端角色回复、handoff/代码文件引用、Orchestrator 验收、产物推荐/确认、Web/Mobile 读回和 Desktop/Electron fallback，结果 `74 passed / 0 failed / 0 warned`。

## 实现摘要

- 新增 `GET /api/conversations` 和 `POST /api/conversations/groups`，把 Role Agent 联系人、单聊 session、群聊 session 聚合为同一会话列表，支持置顶优先和最近活跃排序。
- 左侧会话列表改为“联系人与群聊”，支持搜索、联系人懒创建单聊、群聊创建、置顶、归档/恢复/删除。
- `/api/chat` 增加单聊/群聊收件人边界：单聊不能 `@` 其他联系人，群聊只能 `@` 已加入联系人。
- Role Agent 新增工具集字段、默认工具集、创建/更新校验和 `POST /api/role-agents/draft` 草稿生成。
- `dispatchApprovedAction` 增加 role-agent 工具集执行边界：file、shell、git、artifact、publish、web fetch、PPT 等动作会按 role toolset 校验。
- `RuntimeMessagePart` 扩展 attachment、web preview、publish status、artifact、diff apply 元数据；IM 消息流支持内联附件、网页预览、发布状态、artifact、diff 和全屏预览。
- 新增 `POST /api/workspaces/:id/diff/apply`，校验 unified diff 和 workspace path 后创建 pending `apply_diff` action，并写入 IM 可见 approval 消息。
- 新增 presentation artifact 生成/预览 API 和下载修复。当前 PPTX 生成使用 AgentHub 内置 OpenXML fallback，并在 metadata 中明确 `pptMasterStatus`；未虚假声明已接入 `ppt-master`。
- acceptance schema、shared database/domain types 和测试夹具补充 session/role-agent 新字段。

## 验收证据

通过命令：

```bash
pnpm --filter @agenthub/web test -- __tests__/api/new-rich-contracts.test.ts __tests__/api/artifacts.test.ts __tests__/orchestrator/action-dispatcher.test.ts
pnpm --filter @agenthub/web test
pnpm --filter @agenthub/web type-check
pnpm --filter @agenthub/shared type-check
pnpm --filter @agenthub/web lint
python3 ./.trellis/scripts/task.py validate .trellis/tasks/06-08-bytedance-im-rich-artifacts-agent-contacts
git diff --check
set -a; source docker/.acceptance.env; set +a; REDIS_URL=${REDIS_URL:-redis://localhost:6379} RUNTIME_EXECUTOR=${RUNTIME_EXECUTOR:-real} STRICT_PRODUCT_RUN_ID=BYTEDANCE-IM-RICH-1780856710 STRICT_PRODUCT_CHAT_TIMEOUT_MS=600000 pnpm --filter @agenthub/web exec tsx scripts/verify-strict-single-prompt-product-delivery.ts
```

结果：

- Targeted rich-contract tests PASS：3 files / 28 tests。
- Web Vitest PASS：33 files / 338 tests。
- Web type-check PASS。
- Shared type-check PASS。
- Web lint PASS；仅 Next lint deprecation / ESLint config 既有提示，无 ESLint warnings/errors。
- Trellis task validate PASS：`implement.jsonl` 9 entries，`check.jsonl` 9 entries。
- `git diff --check` PASS。
- Fresh strict Bytedance IM-first UAT PASS：`BYTEDANCE-IM-RICH-1780856710`，`74 passed / 0 failed / 0 warned`。

## Fresh UAT 证据

- Evidence dir: `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/BYTEDANCE-IM-RICH-1780856710/`
- Workspace: `5d834aa9-6f6d-48f3-9609-43571cba3877`
- Session: `799bec52-cf00-4897-a374-18971ab8e03e`
- Plan: `da697e5b-a60c-417b-8389-6e2f2a7f4ea0`
- Final artifact: `c3fcba3d-3ffe-47f3-97ed-f5600213fb2a`
- `GET /api/messages` evidence: `db-messages.json`
- Artifact evidence: `db-artifacts.json`
- Web transcript readback: `opencli-web-transcript-readback.txt`
- Mobile/PWA readback: `opencli-mobile-transcript-readback.txt`
- Web screenshot: `web-workspace.png`
- Mobile screenshot: `mobile-session.png`
- Right sidebar drag/persistence: `opencli-web-right-panel-resize-drag.txt`, `opencli-web-right-panel-resize-persisted.txt`
- Summary: `summary.json`

Fresh UAT 覆盖项：

- Web PASS：中央 IM 展示 Orchestrator 分工、后端工程师、前端工程师、Orchestrator 验收、产物推荐/确认；右侧栏拖动后从 `420px` 到 `620px`，刷新后持久化。
- Worker role replies PASS：中央 IM 与 `GET /api/messages` 证据包含后端工程师执行回复、前端工程师执行回复，`opencli-web-transcript-readback.txt` 与 `db-messages.json` 均可读回。
- Mobile/PWA PASS：同一 session 读回角色过程、状态和文件引用，产物预览路由可读。
- Desktop/Electron PASS via accepted Playwright fallback：`e2e/artifacts/desktop-workspace-page-1200x800.png`、`e2e/artifacts/desktop-settings-page-1200x800.png`。
- Generated product PASS：生成 Node/Express/SQLite calculator，`node --test` 3/3，通过加减乘除、除零/非法输入保护、SQLite history API 和 SQLite 文件持久化检查。
- Artifact recommendation PASS：最终 artifact row 指向 `public/index.html`，metadata 包含模型推荐与确认语义，未把整个文件树默认标为产物。

## 未纳入声明

- 未接入 `https://github.com/hugohe3/ppt-master/`；当前为内置 OpenXML fallback，后续如要 100% 外包给 ppt-master 应单独拆任务。
- 不做完整在线 PPT 编辑、多人协同编辑、历史 release 回档。
