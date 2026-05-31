# 三端 UI 视觉统一返工

## 1. 目标

当前风险不是单个页面缺少样式，而是 Web、Desktop、Mobile/PWA 可能分别像不同参考项目，导致 P0 UI 不像同一个 AgentHub 产品。

本任务是进入最终 Phase 4 前的修正门：先补三端截图对照和统一视觉母版断言，再把三端页面统一到 codeg/shadcn 工作台风格。

## 2. 绑定需求

- `FR-UI-001`
- `FR-WEB-001`
- `FR-DESK-001`
- `FR-MOB-001`
- `FR-CHAT-001`
- `FR-RUNTIME-001`

## 3. 上游依据

- `research/prd.md`
- `research/product/ui-design-system.md`
- `research/ui-phase3-task-plan.md`
- `research/modules/ui-and-visual-testing.md`
- `.trellis/spec/frontend/ui-style-guidelines.md`
- `.trellis/spec/frontend/component-guidelines.md`
- `.trellis/spec/frontend/quality-guidelines.md`

## 4. 视觉母版决策

| 项 | 决策 |
| --- | --- |
| 三端统一视觉母版 | codeg/shadcn 工作台风格 |
| AionUi | 只参考聊天分栏、Agent 卡、LocalAgents、Desktop 轻量会话结构 |
| lobehub | 只参考移动信息架构 |
| cherry-studio | 只参考桌面密度和设置分组 |
| 不能做 | 不能 Web 像 AionUi、Desktop 像 cherry-studio、Mobile 像 lobehub |

## 5. 范围

### 必须做

- 先审计当前 Web、Desktop、Mobile/PWA 截图和核心组件，列出与 `research/product/ui-design-system.md` 的差距。
- 建立或修正共享视觉 token：颜色、圆角、边框、阴影、状态色、按钮尺寸、Badge、输入框、消息气泡、状态卡。
- 确保三端核心页面复用同一组件体系或同一 token，不各自临时堆样式。
- Web 保持三栏 IM 工作台，但视觉语言统一为 codeg/shadcn。
- Desktop 保持完整桌面主壳、Connector Console、Agent 配置中心和本地 Agent 轻量会话，不做成单页检测面板或 Provider/API Key 设置页。
- Mobile/PWA 保持轻量 IM、审批、预览，不做成缩小版 Web IDE。
- E2E 截图必须按 Web/Desktop/Mobile 同状态对照留存。
- 需求不清、PRD 和参考项目冲突、实现无法判断时，必须暂停并生成 `research/prd-amendments/*.md`，等待用户确认后继续。

### 不做

- 不改变 PRD 的三端职责边界。
- 不新增平台 Provider 凭证管理。
- 不把 Desktop 变成完整 Web 三栏工作台，也不把 Desktop 退化成单页检测面板。
- 不引入 Arco、Ant Design 或另一套主组件库。
- 不用截图人工看一眼替代自动化断言。

## 6. TDD 与测试计划

### 先写测试

- 统一母版断言：关键页面存在共享 token 或共享组件标记，按钮、Badge、输入框、状态卡来自同一 variant 体系。
- 三端截图对照：同一状态分别保存 Web、Desktop、Mobile/PWA 截图。
- 布局断言：无横向滚动、关键容器不重叠、长标题/长路径/长消息不溢出。
- 敏感字段断言：本地 Runtime UI 不出现 `API Key`、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、`Base URL`。
- 中文文案断言：用户可见核心流程文案为中文。

### 再改实现

- 优先修正共享组件和设计变量。
- 再替换 Web、Desktop、Mobile/PWA 页面中的临时样式。
- 最后跑三端局部 E2E 和截图对照。

## 7. 验收断言

- [ ] Web、Desktop、Mobile/PWA 同状态截图能看出来自同一视觉母版。
- [ ] Desktop 截图必须包含左侧导航/Session、中间本地 Agent 轻量会话、右侧 Agent 配置中心或其折叠入口。
- [ ] 核心 UI 复用共享 token 或共享组件体系。
- [ ] 三端只在布局密度、栏数和导航方式上差异化，不在基础视觉语言上分裂。
- [ ] 本地 Runtime 检测、认证状态和轻量会话不展示 API Key/Base URL/环境变量表单。
- [ ] 截图、布局、敏感字段、中文文案断言全部进入 E2E 或组件测试。
- [ ] 如产生需求修订，已写入 `research/prd-amendments/*.md` 并回填相关任务。

## 8. Definition of Done

- [ ] 差距审计已完成，并映射到具体 FR-ID。
- [ ] 统一母版测试先于 UI 改动落地。
- [ ] Web、Desktop、Mobile/PWA 页面改造完成。
- [ ] 局部 E2E 通过并有截图留存。
- [ ] 通过后才允许进入 `.trellis/tasks/05-25-visual-e2e-gate/` 的最终全量 Phase 4。
