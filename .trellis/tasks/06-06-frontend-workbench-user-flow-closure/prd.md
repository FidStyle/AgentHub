# 前端用户可见工作台闭环修复

## Goal

修复用户在 strict single-prompt 产品交付验收后发现的前端体验缺口。后端真实链路已经能跑通，但 Web 工作台没有把用户需要理解和操作的过程完整呈现：对话记录过少、权限卡状态语义混乱、右侧变更区职责混杂、Git diff 缺少渐进式披露、代码引用/选区入口不明显、产物缺少持久启动方式。

本任务按 Bytedance 原始 PRD 的用户工作台体验收口：用户从前端真实操作时，必须能看到完整协作过程、审批状态、Git 变更、代码引用和可启动产物。

## User Feedback Captured

1. 对话中没有完整开发过程，只看到开头一句、若干“允许执行”和最后“已发布”。
2. 权限卡的“允许”状态不应该显示为“执行中”；审批通过应显示“已允许/已审批/已通过”，工具执行过程应由单独过程卡或工具卡表达。
3. 右侧“变更”模块不应混合权限控制、编排、Git 管理；Git 应该是单独模块，先显示文件名，点开文件后查看具体 diff。
4. 产物需要持久化保留，并提供一个可启动产物的脚本或命令；用户点一下/复制命令即可通过终端启动服务。
5. 后端已有的选中代码块、选区编辑等能力必须在前端有可见入口，不能只停在 API 支持。
6. 验收必须从前端用户行为模拟出发，再用后端/API 校验。

## Requirements

1. Chat transcript
   - 保留历史和流式 `role_acknowledgement` 作为可见消息。
   - 多 Agent 过程不得被压成一条最终回复。
   - UI 必须能展示 audited process，不暴露私有 chain-of-thought。
2. Permission card
   - pending 显示 `允许本次操作` / `拒绝`。
   - approved/running 显示审批状态 `已允许`，completed 显示 `已执行`。
   - 不用 `执行中` 表示审批状态。
3. Right workbench single responsibility
   - 标签拆为 `角色`、`编排`、`文件`、`Git`、`产物`。
   - `编排` 只展示计划与授权/action 卡。
   - `Git` 只展示 Git 文件变更、diff、stage/unstage/discard、commit history。
   - `文件` 展示文件树、预览、选区编辑和引用入口。
   - `产物` 展示 artifact 预览、编辑、下载和启动脚本/命令。
4. Git progressive disclosure
   - 先看到 staged/unstaged 文件列表。
   - 点击文件才加载/展示 diff。
   - 大 diff 在内部滚动。
5. Code reference and selection UX
   - Markdown 代码块提供 `引用代码`。
   - 文件预览/编辑区提供选区捕获、引用选区、生成 diff、应用/拒绝。
6. Launchable artifact
   - 对 html/folder/web artifact 显示可复制启动命令或 workspace-relative start script。
   - 启动命令必须基于持久化的 artifact metadata/source path，不能只依赖当前 iframe。
   - 如果 artifact 不可运行，明确显示“不可启动/仅可下载或编辑”。
7. Evidence and governance
   - 更新 `research/project-tracker.md` 和 `research/regression-ledger.md`。
   - 增加执行报告。
   - 自动提交并运行治理门禁。

## Acceptance Criteria

- [ ] `pnpm --filter @agenthub/web test -- __tests__/session-store.test.ts __tests__/message-markdown.test.ts` passes.
- [ ] 新增或更新前端测试覆盖：角色确认消息可见、权限审批文案、右栏 `编排/Git/文件/产物` 单职责、Git 先文件后 diff、代码引用入口、产物启动命令。
- [ ] `pnpm --filter @agenthub/web type-check` passes.
- [ ] `git diff --check` passes.
- [ ] 用户从 Web 工作台能看到完整对话过程，而不是只有 prompt、权限卡和最终发布。
- [ ] Git 面板不再混入编排/权限/运行记录。
- [ ] 产物卡显示可持久化启动命令或明确非 runnable 状态。
- [ ] Tracker、ledger、report 更新并通过治理门禁。

## Out of Scope

- 不做 Demo 包和 3 分钟素材。
- 不启动未开始的纯 P2。
- 不实现长期进程托管或 Docker 正式发布，本任务只提供持久启动脚本/命令入口。
- 不暴露模型私有思考链。

## References

- `bytedance_init_prd.md`
- `bytedance_init_video_txt.txt`
- `.trellis/spec/frontend/component-guidelines.md`
- `.trellis/spec/frontend/ui-style-guidelines.md`
- `.trellis/spec/cross-layer/real-flow-acceptance.md`
- `research/product/ui-design-system.md`
