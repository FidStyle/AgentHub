# RICH-DOC-PPT-ARTIFACTS-2026-06-03

## Task

在 Web 工作台跑通 PPT / 富文档 artifact 的生成、预览、基础编辑、二次交互编辑入口和导出基础链路，不做多人协同编辑。

## Bound Requirements

- `bytedance_init_prd.md`: 产物内联、网页/文档/PPT 等富媒体产物、实时预览、二次编辑。
- `bytedance_init_video_txt.txt`: 产物包括飞书文档、Markdown 文档、网页；支持预览、编辑、二次交互。
- `research/prd.md`: `FR-ARTIFACT-001`, `FR-ARTIFACT-201`, `FR-WEB-001`, `FR-UI-001`。
- `research/architecture/technical-design.md`: 文档/PPT 作为类型化 Artifact 进入预览、下载、版本和后续编辑链路。

## User Flow Contract

1. 用户在 Web 工作台右侧「产物」区域创建富文档或演示稿 artifact。
2. 系统通过真实 `/api/artifacts` 写入 durable artifact 记录，绑定当前 workspace/session。
3. 用户能在右栏看到按类型渲染的预览，而不是二进制不可预览空态。
4. 用户能编辑 artifact 标题和正文/结构化内容并保存，刷新后仍能读回。
5. 用户能发起二次交互编辑请求，系统记录用户针对该 artifact 的修改意图，用于后续 Agent 接续处理。
6. 用户能下载导出文件；文档和演示稿至少提供可打开的标准文件导出。

## Data Contract

- Artifact 必须继续以 `artifacts` 表为事实源，不能只存在 React state 或消息 metadata。
- 新类型纳入 `artifact_type`：`document`, `presentation`。
- `content` 保存可编辑源内容：
  - `document`: Markdown 文本。
  - `presentation`: JSON deck model，包含 slides、title、speaker notes 等基础字段。
- `metadata` 保存 preview/export/edit-request 辅助信息，不替代 `content`。
- `PATCH /api/artifacts/:id` 必须支持更新标题和内容，并做 workspace owner 权限校验。
- 导出接口必须从 artifact 真实记录生成文件。

## UI/UX Contract

- Web 用户可见文案必须是简体中文。
- 复用现有右侧 `ArtifactPanel`、Tailwind 语义 token、lucide 图标和项目 UI 组件。
- 预览必须按类型区分：文档渲染 Markdown，演示稿以 slide 画布/列表方式预览。
- 编辑必须有保存中、成功、失败状态；未实现的协同编辑必须不出现可点击假入口。
- 控件必须有中文可访问名称，移动断点不因此引入横向滚动。

## Scope

### In

- `document` / `presentation` artifact 类型。
- Web 右栏创建、预览、基础编辑、保存、二次编辑请求记录。
- 下载导出 document/presentation。
- 单元/API 测试覆盖类型识别、持久化更新和导出。

### Out

- 多人协同编辑。
- 完整 Office 级排版、动画、批注、修订模式。
- 飞书/小程序/第三方发布。
- Mobile 完整编辑器；Mobile 可继续只做预览/下载。

## Acceptance Gate

- `pnpm --filter @agenthub/web test -- <target tests>` 通过。
- `pnpm --filter @agenthub/web type-check` 通过。
- UI 改动不能出现英文主文案、敏感字段、卡片套卡片或纯 HTML 空壳。
- 若未跑真实浏览器/OpenCLI，最终报告必须明确 `OpenCLI not run`，不能写真实 UAT 通过。
