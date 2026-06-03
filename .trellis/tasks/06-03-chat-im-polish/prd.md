# IM 表面体验优化

## Goal

优化 AgentHub Web 工作台中的 IM 表面体验，让对话列表、消息操作、Role Agent 联系人选择和 Artifact 卡片更接近 Bytedance 原始要求中“像 IM 一样与 Agent 协作”的产品形态。范围限定在当前 `feature/chat-im-polish` worktree 的 Web UI 与必要前端状态，不修改共享合同和主干配置。

## What I Already Know

* Bytedance 原始 PRD 要求 IM 聊天作为核心交互范式，包含对话列表、新建/置顶/归档/搜索、单聊/群聊、`@` Agent、上下文连续、消息 pin、回复引用/重新生成、Agent 联系人头像/名称/能力标签、内联产物预览卡片。
* 派生 FR-ID：`FR-CHAT-001`, `FR-AGENT-001`, `FR-ARTIFACT-001`, `FR-RESULT-001`, `FR-UI-001`, `FR-WEB-001`。
* 现有 Web 工作台核心文件：
  * `apps/web/components/workspace/SessionList.tsx`：已有会话搜索、活跃/归档切换、归档、恢复、删除。
  * `apps/web/components/workspace/ChatPanel.tsx`：已有消息流、pin 上下文、`@` role picker、附件、权限模式、slash command、发送/停止。
  * `apps/web/components/workspace/MessageContent.tsx`：已有 Markdown、流式平滑、permission/tool/question/diff/artifact runtime part 卡片。
  * `apps/web/components/workspace/ArtifactPanel.tsx`：已有角色、文件、变更、产物四个右栏 tab；角色 CRUD、文件预览/存为产物、Git 变更、Artifact 卡片。
  * `apps/web/store/session-store.ts`：已有 session CRUD、message fetch、message pin、SSE 消息发送和 runtime parts 聚合。
* 当前可运行基线：依赖已安装，`pnpm -r type-check` 通过。

## Assumptions

* 本任务优先做“表面收口”，不引入新 DB 字段、不修改 runtime gateway，不声称新的主链路完成。
* “消息操作”本轮优先补齐可真实工作的复制/引用/固定上下文交互；重新生成如果没有真实 API 支撑，则只能展示为禁用/不可用原因，不能做假按钮。
* “Agent 联系人体验”优先在 `@` picker 和右栏角色列表中展示中文联系人语义、角色类型、能力标签、编排者状态和稳定选择态；Runtime 名称只作为配置摘要，不把 Claude Code/Codex 当聊天对象。
* “Artifact 卡片”优先改善卡片信息层级、类型中文化、来源/时间/下载/预览状态，不改变 durable artifact API。

## Requirements

* R1 会话列表
  * 会话项信息层级更像 IM：标题、最近消息、更新时间、状态/当前标识、操作按钮稳定。
  * 搜索、活跃/归档切换、归档/恢复/删除现有真实行为保持可用。
  * 长标题、长消息、窄宽度下不能撑破左栏。
* R2 消息操作
  * 每条可操作消息提供固定/取消固定、复制正文、引用到输入框等真实可用操作。
  * 引用操作必须把被引用消息的摘要带入 composer，并在发送前可取消。
  * 没有真实重新生成能力时，重试/重新生成入口必须禁用并说明中文原因，或不显示。
  * 消息操作不能遮挡 Markdown、代码块、permission 卡或 artifact 卡。
* R3 Agent 联系人
  * `@` picker 展示 Role Agent 联系人卡：名称、角色类型、能力标签、编排者标识。
  * 默认角色、已选角色和取消选择状态保持清晰；无角色时给出中文空状态。
  * 右栏角色 tab 文案统一为“角色智能体/联系人”语义，避免用户面向 Runtime 工具名。
* R4 Artifact 卡片
  * Artifact 卡片展示中文类型、来源文件/产物 ID、创建时间、可预览/不可预览状态、下载动作。
  * Markdown/code/diff/html/image/folder/generic_file 预览保持现有行为。
  * 卡片布局在右栏 300-560px 和移动 overlay 下不溢出。
* R5 质量与验收
  * 用户可见文案使用简体中文。
  * 使用现有 `@agenthub/ui`、Tailwind 语义 class 和 lucide 图标。
  * 更新或新增针对 Web 工作台 IM 表面的测试，至少覆盖 type-check、相关组件/状态测试或 Playwright 布局断言。

## Acceptance Criteria

* [x] `pnpm -r type-check` 通过。
* [x] `SessionList` 在长标题/长消息下无横向溢出，归档/恢复/删除仍走真实 API。
* [x] 消息复制与引用操作可用；引用内容可取消，发送后输入区清理引用状态。
* [x] `@` picker 能展示联系人信息和能力标签；选择/取消角色不改变 composer 布局尺寸。
* [x] Artifact 卡片类型中文化并展示来源、创建时间和下载入口；长文件名不撑破右栏。
* [ ] 至少一个 Web E2E/组件测试断言 IM 表面关键交互和无横向滚动。当前已补组件级 helper 回归；已登录工作台布局 E2E 因缺少登录态/DB env 未覆盖。

## Definition Of Done

* 只改本 worktree 内与任务相关的 Web UI、状态、测试和 Trellis 任务上下文。
* 不修改 `research/contracts/*`、项目主干配置或无关模块。
* 完成后运行 `trellis-check`，并至少报告 lint/type-check/相关测试结果。
* 如发现现有 PRD/接口缺口，只在本任务记录为 out-of-scope 或后续项，不用代码隐式扩大产品范围。

## Out Of Scope

* 新增或变更数据库 schema。
* 实现真正的消息重新生成 API、会话置顶持久化、对话式创建 Agent 或完整产物编辑器。
* 修改 runtime gateway、worker、Desktop DeviceChannel、Mobile/PWA 主链路。
* 修改共享合同、`research/project-tracker.md`、`research/contracts/*` 或主干配置。

## Technical Notes

* 必读规范：
  * `research/product/ui-design-system.md`
  * `.trellis/spec/frontend/component-guidelines.md`
  * `.trellis/spec/frontend/ui-style-guidelines.md`
  * `.trellis/spec/frontend/quality-guidelines.md`
  * `.trellis/spec/cross-layer/real-flow-acceptance.md`
  * `.trellis/spec/guides/product-planning-guide.md`
* 当前代码约束：
  * `RoleAgent` picker 只读 `id/name/is_orchestrator`，需要扩展前端类型以利用 API 已有字段。
  * `MessageComposer` 与 `MessageList` 同文件，可通过局部 state 传递引用草稿，不必引入全局 store。
  * `ArtifactRow` 已包含 `artifact_type/source_path/title/content/content_ref/metadata/created_at`，卡片 UI 可直接增强。
  * `session-store` 当前没有 session pin 字段；本任务不实现持久化置顶。

## Verification Notes

* `pnpm -r lint` 通过。
* `pnpm -r type-check` 通过。
* `pnpm --filter @agenthub/web test -- chat-im-polish.test.ts message-markdown.test.ts session-store.test.ts` 通过，26 个测试通过。
* 固定端口 smoke：按并行 worktree 端口规范使用 `chat-polish=3104`。命令：`PORT=3104 APP_BASE_URL=http://localhost:3104 AUTH_URL=http://localhost:3104 NEXTAUTH_URL=http://localhost:3104 AUTH_SECRET=agenthub-local-smoke-secret pnpm --filter @agenthub/web dev`；Playwright 打开 `http://localhost:3104/workspace`，未登录态重定向到首页，HTTP 200，无 pageerror，截图 `/tmp/agenthub-chat-polish-entry-3104.png`。
* 旧 smoke 记录：此前曾用 `http://localhost:3001` 做入口 smoke；按并行 worktree 端口规范，该记录不作为最终验收证据。
* 已登录工作台真实浏览器 UAT 未覆盖：当前 worktree 没有 `TEST_AUTH_STORAGE_STATE`、`TEST_AUTH_COOKIE`、`DATABASE_URL` 或本地 env 文件，不能伪造通过。
