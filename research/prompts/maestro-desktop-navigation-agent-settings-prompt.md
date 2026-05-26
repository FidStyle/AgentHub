# Maestro Prompt：Desktop 可点击导航与独立 Agent 配置页返工

下面内容用于启动 `/maestro-ralph-beta`。目标是让 Maestro 自己完成实现，而不是人工直接写代码。

```text
你现在负责继续修复 AgentHub Desktop P0。不要直接进入最终 Phase 4，先完成 Desktop 主壳的可操作性返工。

必须先读：
- research/prd.md
- research/prd-amendments/desktop-main-shell-agent-config.md
- research/prd-amendments/desktop-navigation-agent-settings-page.md
- research/product-design.md
- research/ui-design-system.md
- research/technical-design.md
- research/automation-reference-comparison.md
- .trellis/spec/frontend/ui-style-guidelines.md
- .trellis/spec/frontend/component-guidelines.md
- .trellis/spec/frontend/quality-guidelines.md
- .trellis/spec/cross-layer/runtime-credential-boundary.md
- .trellis/tasks/05-26-desktop-main-shell-agent-config-refactor/prd.md
- .trellis/tasks/05-26-desktop-main-shell-agent-config-refactor/info.md
- .trellis/tasks/05-26-desktop-main-shell-agent-config-refactor/implement.jsonl
- .trellis/tasks/05-26-desktop-main-shell-agent-config-refactor/check.jsonl

必须实际参考：
- refer_proj/AionUi/packages/desktop/src/renderer/components/layout/Layout.tsx
- refer_proj/AionUi/packages/desktop/src/renderer/components/layout/Sider/index.tsx
- refer_proj/AionUi/packages/desktop/src/renderer/pages/settings/AgentSettings/LocalAgents.tsx
- refer_proj/AionUi/packages/desktop/src/renderer/pages/settings/AgentSettings/AgentCard.tsx
- refer_proj/AionUi/packages/desktop/src/renderer/pages/conversation/components/ChatLayout/index.tsx
- refer_proj/codeg/src/components/layout/sidebar.tsx
- refer_proj/codeg/src/components/chat/conversation-shell.tsx
- refer_proj/codeg/src/components/chat/message-input.tsx

核心目标：
1. Desktop 左侧导航不能只是静态装饰，必须可点击并切换中间主内容。
2. 必须有最小可用路由状态机：本地工作区、最近会话、本地 Agent、待审批、设置。
3. 点击“本地 Agent”必须进入独立 Agent 配置/检测页，不要只把 Agent 卡片塞在右侧窄栏。
4. 独立 Agent 配置页参考 AionUi LocalAgents / AgentCard：已检测 Agent 与待接入 Runtime 分区展示。
5. Codex、Claude Code 是 P0 已接入，可从卡片进入本地轻量会话。
6. OpenCode 和其他 Runtime 是 P0 待接入，不可进入会话，不出现“进入会话”主动作。
7. 右侧栏只作为 Agent/Runtime 摘要、最近诊断和快捷入口，不能替代独立配置页。
8. 中间本地 Agent 会话必须显示当前选中的 Codex 或 Claude Code，并保留轻量输入、执行活动和待审批状态。
9. “打开 Web 工作台”目标不可用时必须在 Desktop 内显示中文错误和下一步，不能打开空白页。
10. UI 必须保持 codeg/shadcn 统一视觉母版；AionUi 只参考 Layout/Sider/LocalAgents/AgentCard/ChatLayout 的结构和交互，不复制 Arco 皮肤。

禁止：
- 禁止 API Key、Base URL、ANTHROPIC_API_KEY、OPENAI_API_KEY 表单。
- 禁止 Electron renderer 直接拼 shell 或直接执行命令。
- 禁止 OpenCode 待接入项可执行。
- 禁止只做 hover/active 样式而没有真实页面切换。
- 禁止只改 CSS 美化，不补交互状态机和 E2E。

TDD 顺序：
1. 先补或更新 Electron E2E，使其先红灯：
   - 点击左侧“本地 Agent”后显示 desktop-agent-config-page。
   - 点击“待审批”后显示 desktop-approvals-page。
   - 点击“设置”后显示 desktop-settings-page。
   - 左侧 active 状态随页面切换更新。
   - 在独立 Agent 配置页点击 Codex/Claude Code 的“进入会话”后，回到 desktop-agent-session，并显示当前选中的 Agent。
   - OpenCode 和其他待接入 Runtime 没有“进入会话”按钮。
   - 敏感字段禁止项仍然成立。
   - 1200x800 下左/中/右不重叠，无横向滚动，并截图留存。
2. 再改实现。
3. 每完成一个切片就运行对应 Desktop E2E，不要等最后。

验证命令：
- pnpm --filter @agenthub/desktop type-check
- pnpm --filter @agenthub/desktop lint
- npx playwright test --config e2e/playwright.desktop.config.ts e2e/tests/desktop/desktop-main-shell.spec.ts
- pnpm test:e2e:desktop

如果实现中发现 PRD、UI 契约、参考项目和当前代码冲突，必须暂停，写入 research/prd-amendments/*.md，并回填 Trellis 任务后再继续。不要自行拍板。
```
