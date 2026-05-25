# UI 基础设施与设计系统落地

## 1. 目标

为 Web、Desktop、Mobile/PWA 提供统一 UI 基础设施，确保后续页面不会继续使用无样式 HTML、大量内联样式或不一致组件。

## 2. 绑定需求

- `FR-UI-001`
- `FR-DEVICE-001`

## 3. 范围

### 必须做

- 梳理并落地 Tailwind CSS 4 设计变量：颜色、边框、圆角、间距、状态色。
- 建立 shadcn/ui 风格基础组件封装或项目内复用入口。
- 建立 codeg/shadcn 统一视觉母版 token 和 variant：按钮、图标按钮、卡片、面板、Badge、消息气泡、输入框、状态卡必须共用同一套视觉语言。
- 建立 lucide-react 图标按钮模式，包含中文 `aria-label` 或 tooltip。
- 为关键容器约定稳定定位点：`workspace-shell`、`chat-panel`、`message-composer`、`artifact-panel`、`connector-console`、`runtime-status-card`、`mobile-session`。
- 提供基础状态组件：空、加载、失败、执行中、待审批、成功、Runtime 未安装、Runtime 未登录。
- 为后续页面任务提供组件示例和视觉测试 helper。

### 不做

- 不重构完整 Web 工作台。
- 不实现 Desktop 具体 Runtime 检测业务逻辑。
- 不新增平台托管模型 Provider 凭证配置。

## 4. UI 参考

- codeg：三端统一视觉母版，包含 shadcn 风格侧栏、输入框工具条、权限弹窗、lucide 图标和中性工作台质感。
- AionUi：只参考高密度工作台和 Agent 卡片的信息层级，不采用 Arco 默认视觉。

## 5. TDD 与测试计划

### 先写测试

- 基础状态组件测试：空、加载、失败、执行中、待审批、成功均能渲染中文文案。
- 统一母版测试：核心组件快照或渲染断言能证明按钮、卡片、Badge、输入框、状态卡共用同一 token/variant。
- 图标按钮测试：按钮有中文可访问名称。
- Runtime 状态卡测试：不出现 `API Key`、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、`Base URL`。
- 布局 helper 测试：能检测横向滚动和关键元素重叠。

### 验收断言

- [ ] 基础组件不依赖大段内联样式。
- [ ] 组件默认文案为中文。
- [ ] 状态组件覆盖 `research/ui-design-system.md` 第 6 章状态。
- [ ] Runtime 本地凭证边界在组件层可测。

## 6. Definition of Done

- [ ] Web 与 Desktop renderer 可复用基础 UI 组件或设计变量。
- [ ] Web、Desktop、Mobile/PWA 页面任务能复用同一视觉母版组件，不能各端自写独立皮肤。
- [ ] 关键定位点规范进入组件实现或示例。
- [ ] 后续 Web/Desktop/Mobile 任务可以直接复用这些组件。
- [ ] 单元/组件测试覆盖基础状态和敏感字段禁止项。
