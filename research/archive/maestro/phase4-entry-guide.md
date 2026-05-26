# Phase 4 进入教程：功能与视觉双重门禁

**日期：** 2026-05-26  
**状态：** 进入 Phase 4 前置教程  
**上游依据：** `research/prd.md`, `research/ui-design-system.md`, `research/ui-phase3-task-plan.md`, `research/technical-design.md`, `.trellis/tasks/05-26-ui-visual-unification-refactor/`

---

## 1. 进入 Phase 4 前必须满足

不能因为 Maestro/Ralph 已经跑完一轮就直接进入最终门禁。进入 Phase 4 前必须先确认：

- `FR-UI-001` 已按 codeg/shadcn 三端统一视觉母版更新。
- `.trellis/tasks/05-26-ui-visual-unification-refactor/` 已执行完成，或有截图和测试证明当前实现不需要返工。
- Web、Desktop、Mobile/PWA 只在布局密度、栏数和导航方式上差异化，不在按钮、卡片、Badge、消息气泡、输入框、状态卡上分裂。
- 本地 Runtime UI 不出现 API Key、Base URL、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 或敏感环境变量保存表单。
- 需求不清、参考项目和 PRD 冲突、验收标准不足时，必须先生成 `research/prd-amendments/*.md` 并暂停。

---

## 2. 推荐执行器

进入 Phase 4 前后的自动化执行建议使用 `maestro-ralph-beta`。

原因：

- 这阶段不是单个固定 milestone，而是要让执行器自己读 PRD、Trellis 任务、截图、测试失败和当前代码状态后决定下一步。
- 它必须能在实现、测试、修复、PRD 反写之间循环。
- 用户不希望被 M17/M18 编号绑死；编号只是内部参考，执行器应按 FR-ID 和任务状态推进。

如果 `maestro-ralph-beta` 在当前环境不稳定，再退回 `maestro-ralph`，但 prompt 必须保持同一套规则。

---

## 3. 给 Maestro/Ralph 的 Prompt

可以直接使用下面这段：

```text
你现在负责 AgentHub 的 Phase 4 前置修正和最终功能/视觉门禁。不要被 M 编号限制，先读取项目状态并自行决定下一步。

必须先读：
- research/prd.md
- research/ui-design-system.md
- research/ui-phase3-task-plan.md
- research/technical-design.md
- research/modules/ui-and-visual-testing.md
- research/phase4-entry-guide.md
- .trellis/spec/frontend/ui-style-guidelines.md
- .trellis/tasks/05-25-ui-phase3-task-plan/prd.md
- .trellis/tasks/05-26-desktop-main-shell-agent-config-refactor/prd.md
- .trellis/tasks/05-26-ui-visual-unification-refactor/prd.md
- .trellis/tasks/05-25-visual-e2e-gate/prd.md

核心规则：
1. FR-UI-001 是硬合同。三端统一视觉母版是 codeg/shadcn 工作台风格。
2. AionUi 只参考聊天分栏、LocalAgents、AgentCard 和 Desktop 轻量会话结构；lobehub 只参考移动信息架构；cherry-studio 只参考桌面密度和设置分组。
3. Web、Desktop、Mobile/PWA 不能分别像不同参考项目。按钮、卡片、Badge、消息气泡、输入框、状态卡和弹窗必须来自同一视觉语言。
4. 先补测试和断言，再改 UI。必须包含功能断言、截图留存、布局断言、统一视觉母版断言、敏感字段断言。
5. Desktop 是完整桌面主壳 + Connector Console + Agent 配置中心 + 本地 Agent 轻量会话，不是单页检测面板，也不是完整 Web 三栏；不允许 API Key、Base URL、ANTHROPIC_API_KEY、OPENAI_API_KEY 表单。
6. Desktop 必须有左侧导航/Session、中间本地 Agent 轻量会话、右侧 Agent 配置中心与 Runtime 状态。Codex/Claude Code 是 P0 已接入，OpenCode 等为待接入且不可执行。
7. 打开 Web 工作台入口必须指向有效 Workspace/Session；Web 不可用时在 Desktop 内显示中文错误和下一步，不能打开空白页。
8. Mobile 是轻量 IM、审批、预览，不做本地 Runtime 接入，不做缩小版 Web IDE。
9. 如果 PRD 没写清、参考项目和当前契约冲突、验收标准不够，必须暂停，生成 research/prd-amendments/*.md，回填 Trellis 任务，等待用户确认。

执行顺序：
1. 先做 Phase 4 前置检查：读取 PRD、设计系统、技术设计、Trellis 任务、当前截图和 E2E 测试。
2. 如果 Desktop 仍是单页检测面板、没有 Agent 配置中心、没有本地轻量会话主区，或打开 Web 工作台为空白，先执行 .trellis/tasks/05-26-desktop-main-shell-agent-config-refactor/。
3. 如果三端视觉不统一，继续执行 .trellis/tasks/05-26-ui-visual-unification-refactor/：测试先行，修正共享 token/组件，再改三端页面。
4. 每完成一个 wave，立即跑对应测试和截图，不要等最后。
5. 前置修正通过后，再执行 .trellis/tasks/05-25-visual-e2e-gate/ 的最终 Phase 4。
6. 最后运行 pnpm lint、pnpm type-check、pnpm test、pnpm test:e2e、pnpm test:e2e:desktop。若仓库脚本或环境有差异，先读取 package.json 和 e2e 配置后选择等价命令。

最终交付：
- 列出通过的测试命令。
- 列出截图产物路径。
- 列出仍需用户确认的 prd-amendments，若没有则明确说明没有。
- 测试未全绿或 UI 不符合统一母版时，不允许声明 Phase 4 通过。
```

---

## 4. Phase 4 本地命令顺序

在前置修正任务完成后，按以下顺序执行：

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm test:e2e
pnpm test:e2e:desktop
```

如果某条命令失败：

- 先看失败是否是需求不清或契约冲突；是则写 `research/prd-amendments/*.md` 并暂停。
- 如果是实现问题，回到对应 Trellis 任务修复，再重新跑失败命令。
- 不允许只更新截图绕过断言。

---

## 5. Phase 4 通过标准

Phase 4 通过必须同时满足：

- Web 1440x900、Web 1024x768、Mobile 390x844、Electron Desktop 1200x800 关键路径全部通过。
- 截图留存在 `e2e/artifacts/` 下，能按 Web/Desktop/Mobile 同状态对照。
- 自动化断言覆盖无横向滚动、关键容器不重叠、长文本不溢出、固定格式组件尺寸稳定。
- 自动化断言覆盖统一视觉母版：共享色板、圆角、按钮、Badge、消息气泡、输入框、状态卡。
- 自动化断言覆盖本地 Runtime 凭证边界。
- 用户可见核心文案为中文。
- 没有未处理的 `research/prd-amendments/*.md`。

---

## 6. 不通过时怎么退回

- UI 风格割裂：退回 `.trellis/tasks/05-26-ui-visual-unification-refactor/`。
- 布局断言失败：退回对应 Web/Desktop/Mobile 任务。
- 本地 Runtime 出现凭证表单：退回 Desktop Connector 或共享 Runtime 状态组件任务。
- PRD 不明确：写 `research/prd-amendments/*.md`，不要让执行器自行拍板。
- 测试命令缺失或不稳定：先修 `e2e` 配置和 helper，再继续页面实现。
