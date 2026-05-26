# Maestro Prompt：三端 P0 UI 统一返工

## 推荐命令

```text
/maestro-ralph-beta
```

## 可复制 Prompt

```text
你现在负责 AgentHub 三端 P0 UI 统一返工。不要只修 Desktop，也不要只做局部样式美化；目标是让 Web、Desktop、Mobile/PWA 在 P0 达到同一套可交付产品 UI。

必须先读：
- research/prd.md
- research/product-design.md
- research/ui-design-system.md
- research/desktop-p0-ui-ux-contract.md
- research/ui-phase3-task-plan.md
- research/modules/ui-and-visual-testing.md
- research/technical-design.md
- research/phase4-entry-guide.md
- research/prd-amendments/desktop-main-shell-agent-config.md
- research/prd-amendments/desktop-navigation-agent-settings-page.md
- .trellis/spec/frontend/ui-style-guidelines.md
- .trellis/spec/frontend/component-guidelines.md
- .trellis/spec/frontend/quality-guidelines.md
- .trellis/spec/cross-layer/runtime-credential-boundary.md

必须实际参考这些代码，不允许只口头说参考：
- refer_proj/codeg/src/components/layout/sidebar.tsx
- refer_proj/codeg/src/components/chat/conversation-shell.tsx
- refer_proj/codeg/src/components/chat/message-input.tsx
- refer_proj/codeg/src/components/chat/permission-dialog.tsx
- refer_proj/AionUi/packages/desktop/src/renderer/components/layout/Sider/index.tsx
- refer_proj/AionUi/packages/desktop/src/renderer/pages/settings/AgentSettings/LocalAgents.tsx
- refer_proj/AionUi/packages/desktop/src/renderer/pages/settings/AgentSettings/AgentCard.tsx
- refer_proj/AionUi/packages/desktop/src/renderer/pages/conversation/components/ChatLayout/index.tsx
- refer_proj/lobehub 里移动会话和设置分组相关页面

统一视觉方向：
1. 三端唯一视觉母版是 codeg/shadcn 工作台风格：中性底色、细边框、紧凑侧栏、小尺寸图标按钮、清晰 hover/focus、低饱和状态色。
2. AionUi 负责结构密度：Sider 路由、LocalAgents 分区、AgentCard 信息层级、ChatLayout 标题/上下文/输入区。
3. Mobile/PWA 可参考 lobehub 的移动信息架构，但不能形成独立视觉皮肤。
4. 禁止 Web、Desktop、Mobile 各自像不同产品。
5. 禁止大面积渐变、装饰性背景球、强阴影浮卡、卡片套卡片、英文 UI 文案、无样式纯 HTML。

颜色/token 要求：
1. 使用 research/ui-design-system.md 的 4.2 颜色变量和 P0 推荐色板方向。
2. 背景使用中性灰；面板/卡片只做轻微层级区分；边框低对比；状态色只服务状态。
3. Web/Desktop/Mobile/PWA 必须共用同一套 token 名称和语义色。
4. 主按钮可以用低饱和蓝，但不要把侧栏、状态、审批都染成 primary。

交互语义要求：
1. 不是所有文字都要点击，但入口、项目、会话、Agent 卡、Runtime 卡、设置项、待审批卡必须可点击或明确 disabled。
2. 纯状态文本才允许不可点击。
3. Desktop 普通展示文本禁止选中复制；输入框、日志详情、错误详情和明确复制按钮是例外。
4. Desktop 所有登录/账号入口统一到 GitHub OAuth 动作，使用 data-auth-action="github-login" 或等价统一定位。
5. 所有主要按钮必须有 hover、focus、active、disabled/loading 或错误反馈；点击不能静默无响应。
6. UI 必须明确告诉用户端侧职责：Desktop 是本地 Agent 控制台，Web 是完整 AgentHub 工作台。不要让用户误以为 Desktop 能完成全部 Web 工作台功能。
7. 当用户在 Desktop 触发完整多 Agent 协作、Artifact/Preview、复杂代码编辑、跨 Session 管理、发布部署等能力时，必须显示中文提示并引导打开 Web 工作台。
8. 登录、Runtime、Agent 卡等关键入口必须使用规范图标：GitHub 使用 GitHub SVG/品牌图标；Codex、Claude Code 使用对应品牌/产品 SVG 图标或项目内规范化图标组件；OpenCode/其他待接入 Runtime 使用统一占位图标。禁止随便用文字或不相关图标代替。

端侧目标：

Web：
- 完整三栏 IM 工作台，不是营销页。
- 左栏 Workspace/Session/审批入口，中栏消息/计划/结果/输入区，右栏 Artifact/Context/Agents/Preview。
- 参考 codeg Sidebar/ConversationShell/MessageInput/PermissionDialog，结合 AionUi 高密度聊天与预览分栏。

Desktop：
- 完整桌面主壳：左侧导航，中间本地 Agent 运行态会话，右侧 Runtime/Agent 摘要。
- Desktop 的职责是本地 Runtime 可用性检测、Workspace 绑定、诊断、待审批、Codex / Claude Code 本地轻量对话和运行态查看。
- Desktop 轻量输入区只承载诊断、继续、重试、停止、查看状态等本地指令；不要把完整多 Agent 任务流、跨 Session 管理、Artifact/Context/Agents/Preview、复杂代码编辑和发布部署搬进 Desktop。
- 主要 AgentHub 工作台仍在 Web；Desktop 必须提供清晰的“打开 Web 工作台”升级入口。
- Desktop 首页/设置页/空状态必须有清晰职责说明，但不能写成长篇说明文：用短文案、状态卡、入口按钮表达“本地能力在这里，完整工作台去 Web”。
- Desktop 对越界功能必须提示，例如“该能力需要在 Web 工作台中完成”，并给出“打开 Web 工作台”按钮。
- “本地 Agent”必须进入独立 Agent 配置/检测页。
- Codex、Claude Code 为已接入；OpenCode 和其他 Runtime 待接入且不可执行。
- Codex / Claude Code / GitHub 等入口必须有规范 SVG 图标。优先复用项目内图标组件或新增 `BrandIcon`/`RuntimeIcon` 这类集中组件，不要在各页面散落临时 SVG。
- 不允许 API Key、Base URL、ANTHROPIC_API_KEY、OPENAI_API_KEY 表单。
- 打开 Web 工作台目标不可用时必须显示中文错误和下一步，不打开空白页。

Mobile/PWA：
- 轻量 Workspace、Session、消息、审批、预览。
- 不做小号 Web IDE，不做本地 Runtime 接入。
- 390x844 无横向滚动，输入框和底部/顶部导航不遮挡消息。
- 视觉上仍与 Web/Desktop 同源。

必须先补或维护红灯测试：
- e2e/tests/web/visual-gate.spec.ts
- e2e/tests/mobile/visual-gate.spec.ts
- e2e/tests/desktop/visual-gate.spec.ts
- e2e/tests/desktop/desktop-main-shell.spec.ts
- e2e/tests/web-workbench.spec.ts
- e2e/tests/mobile/mobile-pwa.spec.ts

测试必须覆盖：
1. Web 1440x900 三栏截图，1024x768 右栏收起或不破版。
2. Mobile 390x844 Workspace、Session、审批、预览截图。
3. Desktop 1200x800 默认 Workspace 页、Agent 配置页、设置页、待审批页截图。
4. 三端无横向滚动、关键区域不重叠、长文本不溢出。
5. 三端同状态截图能看出共用色板、圆角、按钮、Badge、输入框、状态卡。
6. Desktop 点击语义：Workspace 项、最近会话项、Agent 卡、Runtime 卡、设置项、待审批卡可点击或明确 disabled。
7. Desktop 登录入口统一到 GitHub OAuth。
8. 本地 Runtime UI 不出现 API Key / Base URL / ANTHROPIC_API_KEY / OPENAI_API_KEY。
9. Desktop 轻量输入区只验证本地诊断/继续/重试/停止/查看状态类指令；完整任务流必须通过 Web 工作台入口完成。
10. Desktop 出现 Web 专属能力入口时，必须显示中文职责提示并提供打开 Web 工作台动作。
11. GitHub 登录按钮、Codex 卡片、Claude Code 卡片必须渲染规范图标，不允许只有纯文字。

执行方式：
1. 先审查现有三端 UI 和截图测试，写出缺口列表。
2. 先补测试断言，再实现。
3. 优先修共享 token、共享组件、按钮/Card/Badge/Input/状态卡，再改页面。
4. 品牌/Runtime 图标必须集中实现，优先查找项目已有资产；没有资产时新增小型 SVG 组件，保持尺寸、颜色和可访问名称一致。
5. 每改完一个端，运行对应 E2E；每个 wave 后都截图。
6. 如果 PRD 或设计契约不清，暂停并新增 research/prd-amendments/*.md，不要自行拍板。

完成后必须运行：
- pnpm --filter @agenthub/web type-check
- pnpm --filter @agenthub/desktop type-check
- pnpm --filter @agenthub/web lint
- pnpm --filter @agenthub/desktop lint
- npx playwright test --config e2e/playwright.config.ts e2e/tests/web-workbench.spec.ts e2e/tests/web/visual-gate.spec.ts e2e/tests/mobile/mobile-pwa.spec.ts e2e/tests/mobile/visual-gate.spec.ts
- npx playwright test --config e2e/playwright.desktop.config.ts e2e/tests/desktop/desktop-main-shell.spec.ts e2e/tests/desktop/visual-gate.spec.ts

如果 Electron E2E 因 GUI 沙箱启动失败，不要视为通过；记录失败原因，并在可运行环境重跑。
```

## 验收口径

这次完成标准不是“功能能点”或“页面有三栏”，而是：

- 三端视觉同源。
- 颜色/token 明确仿照 codeg/shadcn 的中性工作台气质。
- AionUi 的结构密度和 Agent/会话信息层级被吸收。
- 该点击的地方能点击，不可点击的地方有明确 disabled/状态。
- 三端截图和布局门禁通过。
