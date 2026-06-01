# 验收真实闭环 5：对话附件与 artifact 产出

## Goal

把附件上传和 artifact 产出从视觉入口改为真实数据闭环：附件内容可被 runtime 使用，artifact 可持久读取并展示。

## Requirements

- 附件不能只保存文件名；需要 API、存储、metadata、权限校验和 UI 状态。
- runtime 生成 artifact 时必须写 durable output，至少 DB metadata + 可读内容/path。
- Artifact 面板展示真实 artifact，并支持刷新恢复。

## Acceptance Criteria

- [x] 上传附件后 DB/API 能读取文件元数据和内容引用。
- [x] `@角色` 请求可携带附件上下文。
- [x] runtime 输出 artifact 后右侧面板可见，刷新后仍可见。

## Verification Notes

- 2026-06-01：新增 `/api/attachments`，附件经真实 auth + session owner 校验后落 `messages`，`metadata.attachment` 保存 `name/type/size/content/contentRef`，并 `is_pinned=true` 进入 Context。
- 定向验收：`workspaceId=82f8f149-912d-4c4d-be23-717d8db63327`，`sessionId=4440f116-2a5d-4ef4-a483-e284f9b0df5a`，上传 `acceptance-1780290185547.txt`，附件内容含 `ATTACH_TOKEN_1780290185547`，DB 可读回完整内容和 `contentRef=message:28d3e25b-3cea-43c8-aa06-1fa5a1774b64`。
- `/api/chat` 验收：请求携带 `attachmentIds=[28d3e25b-3cea-43c8-aa06-1fa5a1774b64]`，runtime 回复包含附件令牌 `ATTACH_TOKEN_1780290185547`，证明不是只传文件名。
- Artifact 验收：runtime 回复中的 `<agenthub-artifact ...>` 被解析并额外落一条 pinned artifact message，`metadata.artifact.title=附件验收产物 1780290185547`，`content=附件令牌: ATTACH_TOKEN_1780290185547`；右侧 Artifact 面板和刷新后均可见。
- 截图证据：`e2e/artifacts/opencli-uat/attachment-artifact-panel.png`。
- 验证命令：`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts` PASS（6 tests）；`pnpm env:acceptance:smoke` PASS（CRUD 5/5，chat 14/14）。

## References

- `research/contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md`
- `packages/shared/src/domain/artifact.ts`
- `.trellis/spec/guides/end-to-end-contract-planning.md`
