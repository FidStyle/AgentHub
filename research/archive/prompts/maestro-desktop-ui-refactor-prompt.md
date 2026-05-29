# Maestro Prompt：Desktop UI 返工执行

## 推荐命令

使用：

```text
/maestro-ralph-beta
```

原因：这次不是单步修 bug，而是需要 Maestro 自己完成“读文档 → 跑红灯测试 → 实现 → 再跑 E2E/视觉门禁 → 如遇需求不清则反写 PRD”的闭环。`ralph-beta` 更适合自运行循环；如果它开始发散，再改用手动 `/maestro-analyze` 和 `/maestro-execute`。

## 可复制 Prompt

```text
你现在负责 AgentHub Desktop P0 UI 返工。不要把任务当成普通样式美化，这次目标是把 Desktop 从静态三栏摆放修成可操作桌面应用。

必须先读：
- research/prd.md
- research/product-design.md
- research/ui-design-system.md
- research/technical-design.md
- research/prd-amendments/desktop-main-shell-agent-config.md
- research/prd-amendments/desktop-navigation-agent-settings-page.md
- research/desktop-p0-ui-ux-contract.md
- research/phase4-entry-guide.md
- .trellis/spec/frontend/ui-style-guidelines.md
- .trellis/spec/cross-layer/runtime-credential-boundary.md
- .trellis/tasks/05-26-desktop-main-shell-agent-config-refactor/prd.md

必须实际参考这些代码，不允许只口头说参考：
- refer_proj/AionUi/packages/desktop/src/renderer/components/layout/Layout.tsx
- refer_proj/AionUi/packages/desktop/src/renderer/components/layout/Sider/index.tsx
- refer_proj/AionUi/packages/desktop/src/renderer/pages/settings/AgentSettings/LocalAgents.tsx
- refer_proj/AionUi/packages/desktop/src/renderer/pages/settings/AgentSettings/AgentCard.tsx
- refer_proj/AionUi/packages/desktop/src/renderer/pages/conversation/components/ChatLayout/index.tsx
- refer_proj/codeg/src/components/layout/sidebar.tsx
- refer_proj/codeg/src/components/chat/conversation-shell.tsx
- refer_proj/codeg/src/components/chat/message-input.tsx

当前问题：
1. Desktop 左侧导航只是静态外观，按钮不可真正切换页面。
2. Agent 配置中心被挤在右侧小栏，没有像 AionUi LocalAgents 那样成为独立配置/检测页。
3. Codex / Claude Code 虽然显示已接入，但进入会话动作没有形成可靠状态流。
4. OpenCode / 其他 Runtime 必须是待接入，不可执行。
5. UI 不能是毛坯单页，也不能复制 AionUi 的 Arco 皮肤；视觉母版仍是 codeg/shadcn。
6. Desktop 普通项目/Workspace 文本不应该允许鼠标选中复制；输入框、日志详情和明确“复制”动作是例外。
7. Desktop 所有登录/账号入口必须统一到同一个 GitHub OAuth 登录动作，不允许顶部、侧栏、设置页各自分叉。
8. 部分按钮缺少交互反馈，需要逐个审计，不能点击后无状态、无反馈、无错误提示。
9. 有些区域是纯文字静态展示，但在产品语义上应该是入口、项目、会话、Agent 卡或设置项。不是所有文字都要点击，但该点击的必须点击；纯状态文本才允许不可点击。
10. 当前 UI 审美不达 P0，必须重新学习 AionUi 的结构密度和 codeg/shadcn 的视觉母版，把默认页、Agent 配置页、设置页和待审批页作为同一套 Desktop 设计完成。

必须先跑或补红灯测试：
- e2e/tests/desktop/desktop-main-shell.spec.ts

测试必须覆盖：
1. Electron 启动显示 desktop-main-shell。
2. 左侧“本地 Agent”可点击，点击后主区显示 desktop-agent-config-page。
3. 左侧“待审批”可点击，点击后主区显示 desktop-approvals-page。
4. 左侧“设置”可点击，点击后主区显示 desktop-settings-page。
5. 左侧 active 状态随页面切换更新，使用 aria-current="page" 或等价可测状态。
6. 独立 Agent 配置页显示 Codex、Claude Code 已接入。
7. 独立 Agent 配置页显示 OpenCode 和其他 Runtime 待接入，不出现“进入会话”可执行按钮。
8. 点击 Codex / Claude Code 的“进入会话”后回到本地轻量会话，并显示当前选中 Agent。
9. 敏感字段禁止：页面不得出现 API Key、ANTHROPIC_API_KEY、OPENAI_API_KEY、Base URL。
10. 普通文本禁止选中复制：拖选 Desktop 普通展示区域后，window.getSelection().toString() 为空；输入框、日志详情和明确复制按钮不计入。
11. 登录入口统一：所有登录/账号按钮共享 data-auth-action="github-login" 或等价统一定位点；点击任一入口进入同一个 GitHub 登录状态或同一个登录提示。
12. 按钮交互审计：主要按钮必须点击一次并断言产生页面切换、状态变化、错误提示或 loading/disabled 状态；待接入按钮必须 disabled 且不可执行。
13. “该点击的必须点击”审计：Workspace 项、最近会话项、Agent 卡、Runtime 卡、设置项、待审批卡必须可点击或明确 disabled，并有中文不可用原因。
14. 截图必须覆盖默认 Workspace 页、Agent 配置页、设置页、待审批页，不只截默认页。
15. 1200x800 无横向滚动、左/中/右区域不重叠，并留存截图。

实现要求：
1. 可以改 apps/desktop/src/renderer/components/shell/* 和 apps/desktop/src/renderer/store/console-store.ts。
2. DesktopMainShell 必须有最小页面状态机：workspace、sessions、agents、approvals、settings。
3. DesktopSessionSidebar 必须使用 button 或可访问导航项，不允许继续用不可操作 div 假装导航。
4. 右侧栏只做运行摘要、Runtime 状态和“管理 Agent”快捷入口；完整 Agent 配置必须是左侧“本地 Agent”进入的独立页面。
5. 独立 Agent 配置页参考 AionUi LocalAgents / AgentCard 的结构：已检测 Agent、待接入 Runtime、状态、版本、能力、进入会话动作。
6. 本地会话页参考 AionUi ChatLayout 和 codeg ConversationShell / MessageInput，但只做 Desktop 轻量会话，不复制完整 Web 三栏工作台。
7. 所有用户可见文案必须是中文。
8. 不允许新增 API Key、Base URL 或环境变量保存表单。
9. 不允许 Electron renderer 直接拼 shell 命令。
10. 在 Desktop 根容器或普通展示区设置禁止选中复制的样式，但不要破坏输入框、文本域、日志详情、错误详情和明确复制按钮的可用性。
11. 登录按钮不要各写一套逻辑，必须抽成统一入口或至少统一 data-testid/data-auth-action，并由同一个 handler 驱动 GitHub OAuth 状态。
12. 按钮审计结果要落到代码和测试里：不能只“看了一遍”，必须有可执行断言。
13. 按 `research/desktop-p0-ui-ux-contract.md` 落地点击语义：入口、项目、会话、Agent 卡、Runtime 卡、设置项必须有动作；只有纯状态文本允许不可点击。
14. 按 AionUi/codeg 重新校准 UI：AionUi 负责结构密度和 Agent/会话信息层级，codeg/shadcn 负责视觉母版、按钮、侧栏、输入区和权限交互。

完成后必须运行：
- pnpm --filter @agenthub/desktop type-check
- pnpm --filter @agenthub/desktop lint
- npx playwright test --config e2e/playwright.desktop.config.ts e2e/tests/desktop/desktop-main-shell.spec.ts

如果 Electron E2E 因 GUI 沙箱启动失败，不要把它当成通过；记录失败原因，并在可运行环境中重跑。测试断言失败时必须修到通过。

如果发现 PRD、UI 契约或参考项目冲突：
1. 暂停实现。
2. 新增 research/prd-amendments/*.md。
3. 回填 .trellis/tasks/05-26-desktop-main-shell-agent-config-refactor/prd.md。
4. 等用户确认后继续。
```

## 验收口径

这次 Maestro 完成后，不以“页面看起来像三栏”为通过标准，而以“侧栏可点击、配置页独立、已接入 Agent 可进入会话、待接入项不可执行、E2E 与截图门禁可验证”为通过标准。
