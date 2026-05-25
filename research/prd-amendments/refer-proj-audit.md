# refer_proj 对照审计报告

## 1. AionUi — 组件风格对照

### 发现

- **设计系统**: AionUi 使用 CSS 变量体系（`--bg-1` ~ `--bg-10`、`--text-primary/secondary/disabled`、`--primary/success/warning/danger`），支持完整的 light/dark 双主题切换，通过 `data-theme` 和 `data-color-scheme` 属性控制
- **组件库**: 基于 Arco Design（`@arco-design/web-react`）+ 自定义组件，使用 `classnames` 工具类 + Tailwind 原子类混合
- **动效组件**: 拥有 ShimmerText（文字流光）、MarqueePillLabel（溢出跑马灯）、ContextUsageIndicator（SVG 圆环进度）等精细微交互组件
- **Agent 身份系统**: AgentBadge 组件支持 emoji/SVG/fallback 三级 logo 降级，pill 形态，可点击导航
- **布局**: 使用 Arco Layout + 可拖拽 Sider（支持 snap 阈值、移动端适配、safe-area）
- **输入框**: sendbox 组件极为复杂，支持 @文件引用、/斜杠命令、语音输入、拖拽上传、粘贴服务、输入历史、IME 组合输入

### 差距

| 维度 | AgentHub 现状 | AionUi 水平 | 差距等级 |
|------|-------------|------------|---------|
| 主题切换 | 仅亮色模式，无 dark mode token | 完整 light/dark 双主题 CSS 变量 | **高** |
| 微交互动效 | 仅 animate-spin | shimmer、marquee、breathing 等多种 | **中** |
| Agent 身份展示 | 无 Agent badge/avatar 组件 | 完整的 AgentBadge + logo 降级链 | **高** |
| Context 用量可视化 | 无 | SVG 圆环 + popover 详情 | **中** |
| 输入框能力 | 单行 Input + Enter 发送 | @文件、/命令、语音、拖拽、历史 | **高** |
| 移动端适配 | 固定 grid-cols 无响应式 | 完整移动端检测 + safe-area + 折叠 | **高** |

### 建议

1. **P0**: 在 `globals.css` 中补充 dark mode token（使用 `@media (prefers-color-scheme: dark)` 或 `[data-theme='dark']`），oklch 色值只需调整 lightness 通道
2. **P0**: 新增 `AgentAvatar` 组件，支持 model logo / emoji / fallback 三级降级
3. **P1**: 为 sendbox 增加 `/` 命令菜单和 `@` 文件引用能力（可分阶段）
4. **P2**: 添加 ShimmerText 等微交互组件用于 streaming 状态展示

---

## 2. codeg — Desktop Console 状态卡对照

### 发现

- **Task 系统**: 独立的 `TaskContext`（useReducer 驱动），支持 pending/running/completed/failed 四态，带 progress 百分比
- **StatusBar 组件群**: 拆分为 6 个独立子组件（Tasks、Tokens、Connection、Stats、SessionInfo、Alerts），组合在底部状态栏
- **状态指示**: `ConversationStatusDot` 使用颜色编码（green/blue/yellow/red）+ 尺寸变体（xs/sm/md），`ConnectionStatusIndicator` 带 animate-pulse
- **会话卡片**: `SidebarConversationCard` 支持右键菜单（重命名/删除/状态切换）、双击打开 Tab、状态点指示
- **面板系统**: 使用 `react-resizable-panels` 实现三栏可拖拽布局，支持 aux-panel（文件树/git changes/session files）+ terminal panel
- **Context 嵌套**: 深度 Provider 嵌套（12+ 层），每个关注点独立 Context

### 差距

| 维度 | AgentHub 现状 | codeg 水平 | 差距等级 |
|------|-------------|-----------|---------|
| 任务进度追踪 | StateCard 仅展示静态状态 | TaskContext + progress bar + 状态栏实时展示 | **高** |
| 状态栏 | 无 | 6 组件组合的底部状态栏（token/连接/任务/告警） | **高** |
| 会话卡片交互 | 仅 click 选中 | 右键菜单 + 双击 Tab + 状态点 + 时间标签 | **中** |
| 面板可调 | 固定 grid-cols 宽度 | react-resizable-panels 可拖拽 + 持久化 | **高** |
| 连接状态 | StateCard offline 变体 | 实时 dot 指示 + animate-pulse + 状态文案 | **中** |
| 多 Tab 支持 | 无 | TabProvider + TabBar + 多会话并行 | **中** |

### 建议

1. **P0**: 将 `WorkspaceShell` 的固定 `grid-cols` 替换为 `react-resizable-panels`（或类似方案），支持用户拖拽调整三栏宽度
2. **P0**: 新增 `StatusBar` 组件，至少包含连接状态 + 当前任务进度 + token 用量
3. **P1**: 为 `StateCard` 增加 `progress` prop，支持进度条展示（running 变体）
4. **P1**: `SessionList` 增加右键菜单（重命名/删除）和状态指示点
5. **P2**: 引入 TaskContext 模式，将 agent 执行状态从 UI 组件中解耦

---

## 3. lobehub — 三栏信息密度对照

### 发现

- **虚拟化列表**: 使用 `virtua`（VList）实现消息列表虚拟滚动，支持 auto-scroll、scroll-to-bottom、per-topic scroll 位置持久化
- **布局容器**: `DesktopLayoutContainer` 使用 CSS 变量动态控制 padding/border-radius，适配 macOS 不同版本窗口圆角
- **NavPanel**: 独立的侧边导航面板，使用 `ScrollShadow` + `TooltipGroup` + Suspense fallback skeleton
- **ChatItem 结构**: 消息项包含 Avatar + Title + MessageContent + Actions + FollowUpChips，支持 bubble/flat 两种变体
- **WideScreenContainer**: 宽屏时限制内容最大宽度，保持阅读舒适度
- **Conversation Store**: 独立的 ConversationStore 管理消息数据，与全局 ChatStore 解耦
- **信息密度**: 每条消息包含 avatar、title、time、actions bar、follow-up chips，信息层次分明
- **Skeleton 加载**: 列表和 header 都有对应的 Skeleton 占位组件

### 差距

| 维度 | AgentHub 现状 | lobehub 水平 | 差距等级 |
|------|-------------|-------------|---------|
| 消息列表虚拟化 | `overflow-y-auto` 全量渲染 | virtua VList 虚拟滚动 | **高** |
| 自动滚动 | 无 | AutoScroll + BackBottom + scroll 位置持久化 | **高** |
| 宽屏适配 | 无 max-width 限制 | WideScreenContainer 限制阅读宽度 | **中** |
| 消息信息密度 | 仅 content 文本 | avatar + title + time + actions + follow-up | **高** |
| 加载骨架屏 | StateCard loading | 列表级 SkeletonList + 单项 SkeletonItem | **中** |
| 消息操作栏 | 无 | hover 显示 actions bar（复制/编辑/重试/删除） | **高** |
| Store 架构 | 单一 sessionStore 混合 | ConversationStore 独立 + selectors 模式 | **中** |

### 建议

1. **P0**: 引入虚拟滚动（推荐 `virtua` 或 `@tanstack/virtual`），消息超过 50 条时性能差距明显
2. **P0**: 为消息项增加 hover actions bar（复制/重试/删除），这是 chat 产品的基本交互
3. **P1**: 添加 AutoScroll 逻辑 + "回到底部" 按钮，streaming 时自动跟随
4. **P1**: 消息项增加 avatar + 时间戳 + model 名称展示
5. **P2**: 添加 WideScreenContainer，在 >1200px 宽度时限制消息区最大宽度为 768px

---

## 4. cherry-studio — 消息流渲染对照

### 发现

- **Block 架构**: 消息内容拆分为独立 Block 类型（MainText、Thinking、Tool、Image、Video、Citation、Error、File、Translation、Compact），通过 `MessageBlockRenderer` 统一调度
- **动画系统**: 使用 `motion/react`（framer-motion）为每个 Block 添加入场动画（opacity + x 位移），streaming 时启用动画
- **Thinking Block**: 可折叠的思考过程展示，带实时计时器（100ms 精度）、自动折叠配置、独立复制按钮
- **消息头**: 完整的 MessageHeader（avatar + username + timestamp + token 用量），支持 bubble/flat 两种风格
- **Inputbar**: 功能丰富的输入栏，包含 @模型提及、附件预览、知识库输入、token 计数、工具栏
- **Redux Store**: 使用 Redux + messageBlocksSelectors 管理 block 状态，支持 block 级别的 streaming 状态追踪
- **错误边界**: 每个 Block 包裹 ErrorBoundary + BlockErrorFallback，单个 block 崩溃不影响整体
- **styled-components**: 使用 CSS-in-JS 方案，组件样式内聚

### 差距

| 维度 | AgentHub 现状 | cherry-studio 水平 | 差距等级 |
|------|-------------|-------------------|---------|
| 消息结构 | 单一 `msg.content` 文本 | Block 架构（text/thinking/tool/image/...） | **高** |
| Thinking 展示 | 无 | 可折叠 + 计时器 + 自动折叠 + 复制 | **高** |
| 入场动画 | 无 | motion/react spring 动画 per-block | **中** |
| 错误隔离 | 无 | ErrorBoundary per-block | **中** |
| Tool 调用展示 | 无 | ToolBlock + ToolBlockGroup 分组展示 | **高** |
| Markdown 渲染 | 无（纯文本） | 完整 Markdown + 代码高亮 + Mermaid | **高** |
| 附件/图片 | 无 | ImageBlock + FileBlock + VideoBlock | **中** |
| 消息编辑 | 无 | MessageEditor 内联编辑 | **低** |

### 建议

1. **P0**: 设计 Block 架构，将消息内容从单一 string 拆分为 `MessageBlock[]`（至少支持 text、thinking、tool_call 三种类型）
2. **P0**: 集成 Markdown 渲染器（推荐 `react-markdown` + `rehype-highlight`），这是 AI chat 产品的基础能力
3. **P0**: 添加 ThinkingBlock 组件，支持折叠/展开 + streaming 计时
4. **P1**: 为 streaming 消息添加 block 级入场动画（可用 CSS transition 替代 framer-motion 以保持轻量）
5. **P1**: 每个消息 block 包裹 ErrorBoundary，防止单条消息渲染崩溃影响全局
6. **P2**: 添加 ToolBlock 展示 agent tool_call 的输入/输出

---

## 总结: 关键差距优先级

### P0 — 必须补齐（功能性缺失）

| # | 差距 | 来源 | 影响 |
|---|------|------|------|
| 1 | Markdown 渲染 | cherry-studio | AI 回复无法正确展示代码/列表/链接 |
| 2 | Block 消息架构 | cherry-studio | 无法展示 thinking/tool_call 等结构化内容 |
| 3 | 消息虚拟滚动 | lobehub | 长对话性能瓶颈 |
| 4 | Dark mode | AionUi | 用户体验基本需求 |
| 5 | 面板可拖拽 | codeg | 固定宽度无法适配不同屏幕 |
| 6 | 消息 hover actions | lobehub | 复制/重试是 chat 产品基本操作 |
| 7 | StatusBar | codeg | 连接状态/任务进度无处展示 |

### P1 — 应当补齐（体验差距）

| # | 差距 | 来源 |
|---|------|------|
| 8 | AutoScroll + 回到底部 | lobehub |
| 9 | ThinkingBlock 折叠展示 | cherry-studio |
| 10 | Agent Avatar/Badge | AionUi |
| 11 | 消息时间戳 + model 名称 | lobehub + cherry-studio |
| 12 | 会话卡片右键菜单 | codeg |
| 13 | 任务进度条 | codeg |
| 14 | Block 入场动画 | cherry-studio |

### P2 — 锦上添花

| # | 差距 | 来源 |
|---|------|------|
| 15 | WideScreenContainer | lobehub |
| 16 | ShimmerText 微交互 | AionUi |
| 17 | Context 用量圆环 | AionUi |
| 18 | Sendbox @文件/命令 | AionUi |
| 19 | ErrorBoundary per-block | cherry-studio |
| 20 | ToolBlock 展示 | cherry-studio |

---

> 审计日期: 2026-05-25 | 对照项目: AionUi, codeg, lobehub, cherry-studio
