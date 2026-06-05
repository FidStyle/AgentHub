# REMAINING-P1-FEATURES-2026-06-05: 剩余 P1 功能收口合同

## 1. 元信息

| 字段 | 内容 |
| --- | --- |
| TASK-ID | `REMAINING-P1-FEATURES-2026-06-05` |
| 优先级 | `P1` |
| Trellis 任务 | `.trellis/tasks/06-05-remaining-p1-features` |
| 最高事实源 | `bytedance_init_prd.md` > `bytedance_init_video_txt.txt` > 用户最新决策 |
| 用户最新决策 | 完成剩余 P1；Demo 包和 3 分钟素材不需要处理；未开始的纯 P2 不启动 |
| 绑定 FR-ID | FR-CHAT-001, FR-AGENT-001, FR-ORCH-001, FR-CTX-001, FR-ARTIFACT-001, FR-ACTION-001, FR-WEB-001, FR-MOB-001, FR-DESK-001, FR-UI-001 |

## 2. 范围

本任务从 `research/sequential-execution-progress.md` 的 P1 队列接续，只做第 7、8、9 项：

- IM/联系人/自建 Agent 体验补全。
- 聊天式部署发布闭环。
- Mini IDE / 富文档 / Artifact workbench 演示链路硬化中的 P1 可交付部分。

明确排除：

- 最终 Demo 包。
- 3 分钟 Demo 视频素材。
- 未开始的纯 P2 能力：PPT 高级浏览、完整版本历史、多人协同编辑、完整局部选区 Agent 编辑、第三方发布平台、小程序/飞书发布。

## 3. 用户链路合同

### 3.1 IM、联系人、自建 Agent

1. 用户进入真实 Workspace。
2. 右侧或联系人入口可看到内置 Role Agent 和用户自建 Role Agent，包含头像/首字母、名称、角色类型、能力标签、Runtime、是否可被 Orchestrator 调度。
3. 用户可以从模板或表单创建 Role Agent，编辑名称、角色类型、System Prompt、能力标签、Runtime、是否参与编排，并刷新后读回。
4. 用户可以在聊天输入框 `@` 选择一个或多个 Role Agent；引用/回复消息时，引用内容进入后续消息上下文。
5. 失败/不可用的重新生成或重试入口必须要么可执行，要么明确禁用并解释原因，不能保留假按钮。

### 3.2 聊天式部署发布闭环

1. 用户在聊天中输入部署意图，例如“部署当前网站”。
2. Orchestrator/权限系统将部署识别为受控 Action，进入审批链路，显示部署目标、工作区、命令或生成方式、风险说明。
3. 用户拒绝时不执行部署，并持久化拒绝记录。
4. 用户允许后，系统在 workspace root 内生成可读回的部署产物记录，至少包含部署状态卡片、预览 URL 或本地静态预览路径、manifest/source path、创建时间和执行结果。
5. Web 聊天流和 Artifact/Preview 区能读回部署状态；Mobile/PWA 能查看部署卡片或部署结果摘要；Desktop/Electron 能显示部署/预览相关状态或通过 fallback UAT 证明桌面壳不破。

本任务不要求真实外网云发布；允许实现为 workspace 内静态站点打包/预览 URL/manifest 的本地自托管闭环，但必须真实持久化、可刷新、可下载或可打开，不能只返回文案。

### 3.3 Artifact Workbench

1. 用户能在右侧 Artifact 区查看网页、Markdown/文档、代码、Diff、目录、部署结果等产物。
2. 用户能创建或从 workspace 文件导入富文档/演示结构的基础 artifact；刷新后仍能读回。
3. 用户能编辑 artifact 标题和可编辑源内容并保存；保存失败时显示中文错误态。
4. 用户能对可编辑文件或 artifact 发起二次交互编辑请求，系统把“针对哪个产物、用户想改什么”持久化为消息、上下文或 action 记录，供后续 Role Agent 接续。
5. Mini IDE P1 只要求基础文件预览、代码/Markdown 编辑、Diff/patch 草案、应用 patch、下载/导出、无横向溢出；不要求完整 Monaco/多人协同/版本历史。

## 4. 三端职责

| 端 | 必须覆盖 | 不承担 |
| --- | --- | --- |
| Web | 完整创建/编辑 Agent、聊天式部署、Artifact workbench、权限审批、文件/变更/产物读回 | 不把不可执行按钮伪装成完成 |
| Mobile/PWA | 查看联系人/角色摘要、会话消息、审批、部署/Artifact 结果摘要或预览 | 不做复杂 Agent 配置、复杂代码编辑 |
| Desktop/Electron | Runtime/本地能力状态不被 P1 改动破坏；部署/Artifact 状态至少可通过 Electron smoke/fallback 验证主壳可用 | 不复制完整 Web workbench |

## 5. 数据与权限合同

- Role Agent 使用 `role_agents` 作为事实源。
- Artifact 使用 `artifacts` 作为事实源。
- 部署结果必须落真实 DB 表或 durable artifact/message/action metadata，不得只存在 React state。
- 部署、写文件、删除、覆盖、执行命令必须走权限/Action broker 或等价审批路径。
- 所有 workspace 文件路径必须限制在 selected workspace root 内。
- 主链路不得使用 fake/script runtime 作为成功证据。

## 6. 测试与验收

自动化最低门禁：

- `pnpm --filter @agenthub/web test -- <focused suites> --run`
- `pnpm --filter @agenthub/web type-check`
- `pnpm --filter @agenthub/shared type-check`
- `pnpm --filter @agenthub/web lint`
- `git diff --check`

三端验收：

- Web：OpenCLI browser 优先，覆盖 Agent 创建/编辑、聊天式部署、Artifact workbench。
- Mobile/PWA：OpenCLI browser `/m/...` 或移动视口，覆盖查看、审批、部署/Artifact 结果。
- Desktop/Electron：若 OpenCLI 无 AgentHub app adapter，使用 Playwright Electron fallback 并明确原因。

公开治理：

- 更新 `research/project-tracker.md`。
- 更新 `research/sequential-execution-progress.md`。
- 新增 execution report。
- 运行 `bash scripts/verify-governance-gate.sh REMAINING-P1-FEATURES-2026-06-05`。

## 7. 完成标准

- [ ] P1 队列第 7、8、9 项均有真实用户链路实现和证据。
- [ ] Demo/3 分钟素材保持排除，不因本任务被标记完成。
- [ ] 未开始的纯 P2 保持 queued/not-started。
- [ ] Web/Mobile/Desktop 三端验收记录明确 pass、fallback 或 not-applicable 原因。
- [ ] 所有变更已提交，工作区 clean。
