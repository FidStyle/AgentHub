# AgentHub 三端 UI 设计系统

**作者：** joytion, Codex  
**日期：** 2026-05-26
**状态：** Draft  
**版本：** 0.2
**上游文档：** `research/prd.md`, `research/product/product-design.md`, `research/architecture/technical-design.md`  
**绑定需求：** `FR-UI-001`, `FR-DEVICE-001`, `FR-WEB-001`, `FR-DESK-001`, `FR-MOB-001`, `FR-CHAT-001`, `FR-ARTIFACT-001`, `FR-RESULT-001`, `FR-PERM-001`

---

## 1. 目标

本文定义 AgentHub P0 的三端 UI 合同。它不是视觉建议，而是实现和验收必须引用的设计系统。

P0 UI 必须满足：

1. Web、Desktop、Mobile/PWA 都有真实可用的产品界面，不交付无样式纯 HTML。
2. 三端共享组件审美、中文术语、状态表达和视觉质量门禁。
3. Web 是高密度 IM 工作台，Desktop 是 Connector Console，Mobile/PWA 是轻量 IM、审批和预览端。
4. 所有核心页面的 E2E 必须包含截图、布局断言和状态断言。

---

## 2. 参考项目结论

| 参考源 | 参考路径 | 借鉴点 | 不采用点 | 绑定需求 |
| --- | --- | --- | --- | --- |
| AionUi | `refer_proj/AionUi/src/renderer/pages/conversation/components/ChatLayout/index.tsx` | 高密度聊天与预览分栏、紧凑工具条、会话与产物并行展示 | 不直接采用 Arco 作为主组件库，不复制其全部设置体系 | `FR-WEB-001`, `FR-ARTIFACT-001`, `FR-UI-001` |
| AionUi | `refer_proj/AionUi/packages/desktop/src/renderer/pages/settings/AgentSettings/LocalAgents.tsx`, `AgentCard.tsx` | Desktop 本地 Agent 检测列表、Agent 卡片信息层级、状态标签、能力描述、进入会话动作 | 不把 Runtime 凭证字段放进 Agent 卡片，不复制 AionUi 的完整 Agent 市场 | `FR-DESK-001`, `FR-AGENT-001`, `FR-RUNTIME-001`, `FR-UI-001` |
| AionUi | `refer_proj/AionUi/packages/desktop/src/renderer/pages/conversation/components/ChatLayout/index.tsx` | Desktop 轻量会话的标题区、Agent 身份展示、工作区侧栏和预览折叠行为 | 不把 Desktop 变成完整 Web 三栏工作台，不引入 Arco 作为主组件库 | `FR-DESK-001`, `FR-CHAT-001`, `FR-UI-001` |
| codeg | `refer_proj/codeg/src/components/layout/sidebar.tsx` | shadcn 风格侧栏、紧凑导航、图标按钮和分组 | 不采用过度单页 IDE 化的信息堆叠 | `FR-WEB-001`, `FR-UI-001` |
| codeg | `refer_proj/codeg/src/components/chat/conversation-shell.tsx` | 会话壳、消息区和上下文工具区的组合方式 | 不让聊天成为只有文本流的空白页 | `FR-CHAT-001`, `FR-UI-001` |
| codeg | `refer_proj/codeg/src/components/chat/message-input.tsx` | 输入框工具条、附件入口、模式选择和发送动作 | 不保留英文按钮文案 | `FR-CHAT-001`, `FR-UI-001` |
| codeg | `refer_proj/codeg/src/components/chat/permission-dialog.tsx` | 权限确认弹窗的信息密度和动作分区 | 不把 Git diff 当成审批对象 | `FR-PERM-001`, `FR-UI-001` |
| lobehub | `refer_proj/lobehub` | 移动会话布局、设置页分组、模型状态表达 | 不引入重型模型供应商配置作为 P0 主流程 | `FR-MOB-001`, `FR-UI-001` |
| cherry-studio | `refer_proj/cherry-studio` | 桌面应用的信息密度、Provider/Agent 设置参考 | 不把本地 Claude Code / Codex 变成 API Key Provider 表单 | `FR-DESK-001`, `FR-RUNTIME-001`, `FR-UI-001` |

结论：P0 采用 `shadcn/ui + Tailwind CSS 4 + lucide-react` 作为统一组件与样式基线。三端统一视觉母版以 codeg 的 shadcn 工作台风格为准；AionUi、lobehub、cherry-studio 只作为结构、密度和端侧行为参考，不再作为独立视觉风格来源。

---

## 3. 统一视觉母版

### 3.1 母版决策

三端必须像同一个产品，而不是 Web 像 AionUi、Desktop 像 cherry-studio、Mobile 像 lobehub。P0 视觉母版统一为：

| 项 | 决策 |
| --- | --- |
| 主视觉来源 | codeg 的 shadcn 工作台风格：中性底色、细边框、紧凑侧栏、图标按钮、组合式消息/权限组件 |
| 主组件语言 | shadcn/ui 风格组件 + Tailwind CSS 4 语义变量 + lucide-react 图标 |
| AionUi 使用方式 | 只借鉴高密度工作台结构、聊天与预览分栏、LocalAgents 检测列表、Agent 卡片信息层级和 Desktop 轻量会话结构 |
| lobehub 使用方式 | 只借鉴移动会话和设置分组的信息架构，不采用其视觉皮肤或模型供应商重配置 |
| cherry-studio 使用方式 | 只借鉴桌面应用密度和设置分组，不采用 Provider/API Key 配置作为本地 Runtime 主流程 |
| 三端差异 | Web、Desktop、Mobile/PWA 信息密度和布局不同；颜色、圆角、按钮、卡片、状态、消息、输入框、Badge、弹窗视觉语言必须一致 |

### 3.2 共享组件硬约束

后续实现必须先落共享组件，再组装端侧页面。三端页面不能各自临时写一套外观。

| 组件族 | 三端统一要求 |
| --- | --- |
| Shell | 统一使用细边框、紧凑标题栏、低饱和背景和稳定滚动容器；端侧只调整栏数和密度 |
| Button/IconButton | 来自同一套 variant/size；工具按钮优先 lucide 图标，必须有中文可访问名称或 tooltip |
| Card/Panel | 8px 或更小圆角、1px 边框、少阴影；禁止页面区块浮卡化和卡片套卡片 |
| Badge/StatusPill | 统一 ready、running、warning、failed、muted 状态色，不允许每端自定义一套色板 |
| MessageBubble | 用户、Role Agent、系统消息使用同一视觉规则；移动端只改变宽度和排列，不改变皮肤 |
| Composer | 输入框、工具条、发送按钮和 disabled/loading 状态三端一致；移动端可压缩工具入口 |
| Approval/Permission | 风险说明、影响范围、批准/拒绝按钮统一；拒绝和危险动作不能混淆 |
| RuntimeStatusCard | 只展示检测、版本、认证状态、能力和修复引导；不展示 API Key、Base URL 或环境变量表单 |

### 3.3 禁止的风格分裂

- 禁止 Web、Desktop、Mobile/PWA 分别复刻不同参考项目的视觉皮肤。
- 禁止 Desktop 因参考 cherry-studio 而变成 Provider 设置页风格。
- 禁止 Mobile 因参考 lobehub 而引入独立模型供应商配置视觉。
- 禁止 AionUi 的 Arco 默认风格进入主组件系统。
- 禁止页面直接用大段 Tailwind class 拼出一套绕开共享组件的临时 UI。

---

## 4. 设计基线

### 4.1 技术基线

| 项 | 决策 |
| --- | --- |
| 组件模式 | shadcn/ui 风格组件，按项目需要落到 `apps/web/components` 与 `apps/desktop/src/renderer/components` |
| 样式系统 | Tailwind CSS 4，优先使用语义 class 和设计变量，不写大段内联样式 |
| 图标 | `lucide-react`，按钮优先使用图标加 tooltip 或图标加短中文标签 |
| 文案 | 全部用户可见文案使用简体中文，技术产品名和命令名可保留英文 |
| 视觉测试 | Playwright 截图、bounding box 布局断言、移动断点断言、敏感信息断言 |

### 4.2 颜色变量

P0 使用克制的中性工作台配色，尽可能仿照 codeg/shadcn 的产品气质：低饱和背景、细边框、轻微层级区分、状态色只在必要位置出现。AionUi 的高密度结构可以学习，但不复制 Arco 的默认蓝色皮肤。三端颜色必须像同一个产品，不能 Web 一套、Desktop 一套、Mobile 又一套。

禁止使用单一紫蓝、深蓝、米色、棕橙等一眼模板化主题；禁止大面积渐变、装饰性背景球、强阴影卡片。具体变量在 Tailwind 主题中落地时必须保持以下语义。

| 变量 | 用途 | 建议 |
| --- | --- | --- |
| `background` | 页面底色 | 近白或深色模式下的近黑灰，不使用大面积渐变 |
| `foreground` | 主文本 | 与背景满足 WCAG AA 对比 |
| `card` | 卡片、面板 | 轻微区分于背景，不能形成卡片套卡片 |
| `border` | 分隔线、卡片边框 | 低对比细线，服务信息分区 |
| `muted` | 次级区域 | 用于侧栏、空状态、辅助文字 |
| `primary` | 主动作 | 用于发送、确认、创建，不滥用 |
| `destructive` | 拒绝、删除、高风险 | 权限和失败动作必须清晰 |
| `success` | 成功、已连接 | Desktop 在线、任务成功 |
| `warning` | 待处理、需确认 | 待审批、计划待确认 |
| `info` | 运行中、检测中 | Runtime 检测、执行中 |

#### 4.2.1 P0 推荐色板方向

后续实现可以根据现有 Tailwind token 微调，但必须保持这个视觉方向：

| Token | 浅色模式建议 | 深色模式建议 | 用法 |
| --- | --- | --- | --- |
| `background` | `#f7f7f8` 附近的中性浅灰 | `#0f1115` 附近的近黑灰 | 页面底色 |
| `card` / `panel` | `#ffffff` 或轻微灰白 | `#151820` 附近 | 面板、卡片、侧栏 |
| `muted` | `#eef0f3` 附近 | `#1d222b` 附近 | hover、空状态、次级区块 |
| `border` | `#d9dde3` 附近 | `#2a303a` 附近 | 分隔线、卡片边框 |
| `foreground` | `#171a1f` 附近 | `#f1f3f5` 附近 | 主文本 |
| `muted-foreground` | `#667085` 附近 | `#98a2b3` 附近 | 次级文本 |
| `primary` | `#2563eb` 或低饱和蓝 | `#60a5fa` 附近 | 主动作，不得滥用 |
| `success` | `#16a34a` | `#4ade80` | 已连接、成功 |
| `warning` | `#d97706` | `#fbbf24` | 待审批、需登录 |
| `destructive` | `#dc2626` | `#f87171` | 危险、失败 |

执行要求：

- Web/Desktop/Mobile/PWA 必须共用同一套 token 名称和同一组语义色。
- 页面级背景必须以中性灰为主，卡片/面板只做轻微层级区分。
- 主按钮用 `primary`，但侧栏选中、Agent 状态、审批风险不能全部染成 primary。
- 状态色只服务状态，不做装饰。
- 截图评审时，如果三端看起来像不同设计系统，即使功能测试通过也视为未完成。

### 4.3 间距、圆角和密度

| 项 | 规则 |
| --- | --- |
| 基础间距 | 使用 Tailwind 4 的 4px 基础刻度，常用间距为 4、8、12、16、24、32px |
| 卡片圆角 | 默认 8px 或更小；除头像、圆形图标按钮外不使用大圆角胶囊化界面 |
| 边框 | 面板和卡片使用 1px 边框，避免厚重阴影 |
| 阴影 | 只用于弹窗、下拉、浮层；常规页面区块不用装饰性浮卡 |
| 信息密度 | Web 高密度，Desktop 中密度，Mobile 单列轻量 |
| 字号 | 不用视口宽度缩放字号；工具面板、卡片内标题保持紧凑 |

---

## 5. 三端布局契约

### 5.1 Web 工作台

Web 是完整主工作台，默认布局为三栏：

| 区域 | 宽度/行为 | 内容 |
| --- | --- | --- |
| 左栏 | 260-300px，可折叠 | Workspace 切换、Session 列表、待审批入口 |
| 中栏 | 自适应，最小 420px | 消息流、计划卡、任务结果卡、输入框 |
| 右栏 | 360-420px，可折叠 | Artifacts、Context、Agents、Preview |
| 顶部工具条 | 48-56px | 当前 Workspace、Session 状态、Connector 状态、关键动作 |

Web 首屏必须直接进入工作台、登录页或有明确下一步的空状态。不得把营销式首页当作 P0 主体验。

Web 视觉参考：

- 视觉母版：codeg 的 shadcn 侧栏、会话壳、输入区和权限弹窗。
- 结构密度：AionUi 的高密度聊天/预览分栏。
- 禁止：营销首页、无样式工作台、英文按钮、临时蓝白后台风。

### 5.2 Desktop Connector

Desktop 是 Connector Console 和本地 Agent 轻量工作台，不是 Web 克隆，也不是单页检测面板。

| 区域 | 内容 |
| --- | --- |
| 左侧导航 | 本地 Workspace、最近 Session、本地 Agent、待审批、设置、登录/账号入口 |
| 中间主区 | 本地 Agent 轻量会话、运行流、最近消息、执行状态、失败原因、轻量输入框 |
| 右侧配置面板 | Agent 配置中心、Runtime 状态、能力声明、最近诊断、待接入 Runtime |
| 顶部/底部状态条 | 登录用户、设备名、连接状态、最后心跳、当前 Workspace、打开 Web 工作台入口 |
| 执行与审批面板 | 最近 Action、Runtime 请求、失败原因、待审批和高风险动作确认 |

Desktop 不提供本地 Claude Code / Codex API Key、Base URL、环境变量保存表单。未安装或未登录时只展示检测结果和本机 CLI 修复引导。

Desktop 必须提供 Agent 配置中心：Codex 和 Claude Code 是 P0 已接入 Runtime；OpenCode 和其他 Runtime 在 P0 显示为“待接入”，不可进入会话，不可配置密钥。Desktop 必须提供轻量本地 Agent 会话，但该会话只服务当前 Local Desktop Workspace 的运行态查看、轻量指令、待审批和诊断。完整 Artifact/Context/Agents/Preview 三栏工作台仍属于 Web。

“打开 Web 工作台”必须指向有效 Workspace/Session 路径；Web 未运行、未登录或 Workspace 不存在时，Desktop 必须展示中文错误和下一步，不能打开空白页面。

### 5.3 Mobile/PWA

Mobile/PWA 是轻量控制端。

| 视图 | 内容 |
| --- | --- |
| Workspace 列表 | 最近工作区、连接状态、待审批数量 |
| Session 列表 | 会话标题、最后消息、Agent 状态、未读/待确认 |
| 轻量会话 | 消息流、任务状态、结果摘要、输入框、@ Role Agent |
| 审批详情 | 风险说明、影响范围、批准/拒绝 |
| 预览页 | 预览链接、结果摘要、只读 Diff 或文件摘要 |

Mobile/PWA 不提供本地 Runtime 接入、本地目录选择、复杂代码编辑和桌面级 Diff 合并。

Mobile/PWA 视觉参考：

- 视觉母版仍使用 codeg/shadcn token、按钮、Badge、状态卡和输入框。
- 信息架构可参考 lobehub 的移动会话、设置分组和轻量状态表达。
- AionUi 只提供聊天密度参考，不把移动端做成桌面工作台缩小版。
- 禁止 Mobile 形成独立皮肤；390x844 截图必须能看出与 Web/Desktop 同源。

### 5.4 响应式断点

| 断点 | 规则 |
| --- | --- |
| `< 640px` | 单栏移动布局；右栏内容进入独立视图或底部抽屉 |
| `640-1023px` | 会话列表和消息详情分步展示，避免三栏压缩 |
| `1024-1279px` | Web 可显示左栏 + 中栏，右栏默认收起 |
| `>= 1280px` | Web 显示完整三栏 |
| Electron 默认 | 1100x760 以上保证 Connector Console 不横向滚动 |

---

## 6. 核心组件契约

| 组件 | 必须展示 | 状态 | 视觉要求 | 绑定需求 |
| --- | --- | --- | --- | --- |
| 消息气泡 | 发送方、时间、正文、状态 | pending、streaming、completed、failed | 用户消息与 Agent 消息有明确左右或色块区分，文本不溢出 | `FR-CHAT-001` |
| 输入框工具条 | @ Role Agent、附件/上下文、发送、模式 | empty、focused、sending、disabled | 固定高度，按钮用 lucide 图标，移动端不挤压 | `FR-CHAT-001` |
| Orchestrator 计划卡 | 步骤、角色、依赖、风险、确认动作 | draft、requires confirmation、approved、revising | 结构化卡片，不把 Markdown 当唯一真相 | `FR-ORCH-001`, `FR-PERM-001` |
| 任务结果卡 | 状态、摘要、文件变更、Diff、预览、输出 | succeeded、failed、partial、retrying | 可折叠，失败原因和下一步清晰 | `FR-RESULT-001` |
| Action 状态卡 | 动作类型、风险、执行位置、输出摘要 | pending、running、succeeded、failed、canceled | 中高风险动作有醒目标识 | `FR-ACTION-001`, `FR-PERM-001` |
| 审批卡/弹窗 | 审批类型、风险、影响范围、批准/拒绝 | pending、approved、rejected、expired | 主次按钮明确，拒绝和危险动作不混淆 | `FR-PERM-001` |
| Agent 卡 | 名称、角色、能力标签、调度状态、Runtime 绑定摘要 | enabled、disabled、needs runtime、diagnostic warning | Runtime 是配置摘要，不是聊天对象 | `FR-AGENT-001`, `FR-RUNTIME-001` |
| Desktop Agent 配置卡 | Runtime 名称、接入状态、版本、CLI path、认证状态、能力声明、最近诊断、进入会话 | connected、auth required、not installed、coming soon | Codex/Claude Code 可进入会话；OpenCode 等待接入不可执行 | `FR-DESK-001`, `FR-RUNTIME-001` |
| Runtime 状态卡 | installed、version、authStatus、capability snapshot | ready、not installed、auth required、error | 本地 Runtime 不出现 API Key 输入框 | `FR-RUNTIME-001` |
| Artifact/Preview 面板 | 类型、标题、来源、预览内容、复制/打开 | loading、ready、failed、empty | 右栏可滚动，移动端进入独立页 | `FR-ARTIFACT-001` |
| Workspace/Session 列表 | 标题、执行域、状态、最后活动 | empty、loading、ready、error | 列表项高度稳定，长标题截断 | `FR-WS-001`, `FR-CHAT-001` |

---

## 7. 状态视觉

| 状态 | 文案方向 | 视觉表达 | 禁止 |
| --- | --- | --- | --- |
| 未登录 | 说明需要 GitHub 登录 | 登录按钮、简短说明、无敏感内容 | 展示不可用工作台假状态 |
| 空 Workspace | 引导创建或绑定项目 | 空状态插画可选、主按钮明确 | 大段营销文案 |
| Desktop 离线 | 说明本地任务不可执行 | warning 状态、最近心跳、打开 Desktop 引导 | 声称仍可执行本地 Action |
| Runtime 未安装 | 说明检测不到 CLI | 诊断卡、安装指引、重新检测 | 要求填写 API Key |
| Runtime 未登录 | 说明需在本机 CLI 完成认证 | auth required 状态、本机命令提示 | App 内代登录或保存密钥 |
| 执行中 | 展示当前 Agent、动作和进度 | running 状态、流式消息、可停止入口 | 只显示转圈无上下文 |
| 待审批 | 展示风险和影响范围 | warning 状态、批准/拒绝 | 把 Diff 当审批对象 |
| 失败 | 展示原因、可重试性、下一步 | destructive 或 warning 状态、重试入口 | 吞掉错误或只显示英文堆栈 |
| 成功 | 展示结果摘要和产物入口 | success 状态、文件/预览链接 | 只有“完成”两个字 |

---

## 8. 绝对禁止项

- 禁止交付无样式纯 HTML。
- 禁止把营销首页当作 Web P0 主体验。
- 禁止用户可见 UI 文案使用英文，除非是技术产品名、库名、命令名或协议名。
- 禁止用本地 Claude Code / Codex API Key、Base URL、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 表单作为 P0 Runtime 绑定 UI。
- 禁止大量一次性内联样式替代 Tailwind 设计系统。
- 禁止卡片套卡片、超大圆角、装饰性渐变球、模板化大面积渐变背景。
- 禁止按钮长期只用无语义纯文字；工具按钮优先使用 lucide 图标和 tooltip。
- 禁止文本溢出、按钮文字被截断、卡片互相重叠、移动断点横向滚动。
- 禁止视觉回归截图暴露密钥、完整环境变量或未授权本地路径。
- 禁止三端分别采用不同参考项目的视觉皮肤，导致不像同一个 AgentHub 产品。

---

## 9. Playwright 视觉与布局门禁

### 9.1 覆盖矩阵

| 项目 | 视口 | 必测页面 | 断言 |
| --- | --- | --- | --- |
| Web 桌面 | 1440x900 | 工作台、Session、右栏 Artifact、审批队列 | 三栏存在、卡片不重叠、截图 |
| Web 窄桌面 | 1024x768 | 工作台右栏收起状态 | 主消息区可用、无横向滚动 |
| Mobile/PWA | 390x844 | Workspace 列表、Session、审批详情、预览页 | 单栏布局、底部/顶部导航不遮挡内容 |
| Electron Desktop | 1200x800 | Connector 首页、Runtime 检测、执行活动、待审批 | 状态卡稳定、无 API Key 表单、截图 |

### 9.2 必须断言

- 关键容器截图：`workspace-shell`、`chat-panel`、`artifact-panel`、`connector-console`、`mobile-session`。
- `document.body.scrollWidth <= window.innerWidth + 1`，禁止横向破版。
- 关键卡片通过 bounding box 检查不重叠。
- 长中文标题、长文件名、长路径摘要必须截断、换行或折叠，不能溢出父容器。
- 核心按钮和输入框高度稳定，hover、loading、disabled 不改变布局尺寸。
- Runtime 绑定 UI 不存在 `API Key`、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、`Base URL` 等本地 CLI 密钥表单。
- 截图保存目录按 `e2e/artifacts/<端>/<页面>/<状态>.png` 或 Playwright 默认 artifact 规则集中管理。
- Web、Desktop、Mobile/PWA 同一状态截图必须能看出共享色板、圆角、按钮、Badge、消息气泡、输入框和状态卡来自同一视觉母版。
- 关键页面必须断言共享组件或共享 token 已生效；若页面绕开共享组件自写大段样式，视觉门禁不得通过。

### 9.3 任务切片要求

每个涉及 UI 的 `.trellis/tasks/*/` 任务必须写明：

- 绑定的 `FR-ID`，至少包含一个业务 FR 和必要时的 `FR-UI-001`。
- 引用本文件和 `.trellis/spec/frontend/ui-style-guidelines.md`。
- 功能断言、视觉截图、布局断言和敏感信息断言。
- 参考项目来源，例如 AionUi 聊天分栏、codeg 输入框工具条或权限弹窗。
- 统一视觉母版引用：必须说明 codeg/shadcn 是视觉母版，其他参考源只提供结构或端侧行为。

---

## 10. 与后续执行的关系

实现阶段如果发现现有 UI 与本文冲突，应优先修正实现或任务切片；如果产品方向发生变化，必须先更新 `research/prd.md` 的 `FR-UI-001` 和本文，再进入代码修改。

本文更新后必须同步 `.trellis/spec/frontend/ui-style-guidelines.md`，确保后续 AI 实现能读取到可执行规范。
