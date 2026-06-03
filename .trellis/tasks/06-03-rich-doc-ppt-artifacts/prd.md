# PPT and rich document artifacts

## Goal

在 `feature/rich-doc-ppt-artifacts` worktree 中，把 Web 工作台里的 PPT / 富文档产物链路跑通：用户能创建类型化文档/演示稿 artifact，看到可用预览，进行基础编辑和二次交互编辑记录，并能下载导出。当前任务不做协同编辑。

## What I Already Know

- Bytedance 原始 PRD 明确要求 Agent 产出包括代码、网页、文档、PPT 等，并支持预览、二次编辑和后续发布。
- 当前 Web 右栏 `ArtifactPanel` 已有「角色 / 文件 / 变更 / 产物」四个 tab。
- 当前 artifact API 以真实 `artifacts` 表为事实源，支持 list/create/get/rename/delete/download。
- 当前 `artifact_type` 只支持 `html`, `markdown`, `code`, `image`, `diff`, `folder`, `generic_file`。
- 当前 workspace 文件预览只覆盖 HTML/Markdown/code/image/text/folder/binary，docx/pptx 会降级为 binary。
- 本任务优先跑通生成/预览/编辑链路，再补预览和导出；协同编辑明确不在范围内。

## Requirements

- 新增类型化 `document` 和 `presentation` artifact，并保证 DB/API/schema/前端类型一致。
- Web 右侧「产物」tab 支持创建富文档和演示稿。
- 富文档以 Markdown 源内容编辑并渲染预览。
- 演示稿以结构化 JSON deck model 保存，UI 提供基础 slide 预览和文本编辑能力。
- `PATCH /api/artifacts/:id` 支持更新标题、内容和必要 metadata，保存后刷新可读回。
- 提供二次交互编辑请求记录入口，记录用户针对 artifact 的修改意图，供后续 Agent 接续处理。
- 导出接口必须能为 document/presentation 返回可下载文件，不能只返回空占位。

## Acceptance Criteria

- [ ] `/api/artifacts` 可创建 `document` / `presentation` artifact。
- [ ] `/api/artifacts/:id` 可保存标题和内容更新，权限仍按 workspace owner 校验。
- [ ] `/api/artifacts/:id/download` 能导出文档和演示稿文件。
- [ ] Web 右栏能创建、预览、编辑、保存、下载富文档和演示稿。
- [ ] 二次交互编辑请求以 artifact metadata 或等价 durable 字段记录，不只更新前端 state。
- [ ] 相关单元/API 测试通过，`@agenthub/web` type-check 通过。

## Definition of Done

- 代码改动限制在本 worktree。
- 遵守 `research/contracts/RICH-DOC-PPT-ARTIFACTS-2026-06-03.md`。
- 遵守 `.trellis/spec/frontend/*`、`.trellis/spec/cross-layer/real-flow-acceptance.md` 和 `research/product/ui-design-system.md`。
- 完成后运行 `trellis-check`。
- 若产生可沉淀的新规则，运行 `trellis-update-spec`。

## Out of Scope

- 协同编辑。
- 完整 Office 类编辑器、动画、复杂排版、批注修订。
- 第三方发布、飞书/小程序部署。
- Mobile/PWA 完整编辑能力。

## Technical Notes

- 共享合同：`research/contracts/RICH-DOC-PPT-ARTIFACTS-2026-06-03.md`。
- 重点文件：`apps/web/components/workspace/ArtifactPanel.tsx`, `apps/web/app/api/artifacts/route.ts`, `apps/web/app/api/artifacts/[id]/route.ts`, `apps/web/app/api/artifacts/[id]/download/route.ts`, `apps/web/lib/workspace/cloud-workspace-fs.ts`, `docker/postgres/acceptance-schema.sql`。
- 现有测试入口：`apps/web/__tests__/api/artifacts.test.ts`, `apps/web/__tests__/workspace-files-artifacts.test.ts`。
