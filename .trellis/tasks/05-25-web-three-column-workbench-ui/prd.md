# Web 三栏 IM 工作台视觉重构

## 1. 目标

把 Web 首屏和主工作台重构为符合 AgentHub 产品定位的三栏 IM 工作台，替代营销式首页或毛坯页面。

## 2. 绑定需求

- `FR-WEB-001`
- `FR-CHAT-001`
- `FR-ARTIFACT-001`
- `FR-RESULT-001`
- `FR-ORCH-001`
- `FR-PERM-001`
- `FR-UI-001`

## 3. Web UI 模块

| 模块 | 要求 |
| --- | --- |
| 左栏 | Workspace 切换、Session 列表、待审批入口、Connector 状态摘要 |
| 中栏 | 消息流、用户消息、Role Agent 流式消息、计划卡、审批卡、任务结果卡、输入框 |
| 右栏 | Artifacts、Context、Agents、Preview tabs，可折叠 |
| 顶部工具条 | 当前 Workspace、Session 状态、Role Agent 参与状态、关键动作 |
| 空状态 | 登录后无 Workspace 或无 Session 时提供清晰下一步 |

## 4. UI 参考

- AionUi：聊天与预览分栏、高密度工具条、Agent 卡片。
- codeg：侧栏、会话壳、输入框工具条、权限弹窗。

## 5. TDD 与测试计划

### 先写测试

- Web 工作台 E2E：进入工作台后能看到左栏、中栏、右栏或右栏收起入口。
- 消息输入 E2E：输入中文任务，点击发送后出现用户消息和 Agent 状态。
- 计划/审批卡 E2E：计划卡显示步骤、角色、风险、确认动作。
- 任务结果卡 E2E：展示状态、摘要、文件变更、预览入口。
- 视觉断言：1440x900 下三栏不重叠；1024x768 下右栏可收起；无横向滚动。
- 敏感信息断言：Web Runtime 配置摘要不出现本地 CLI API Key 表单。

### 验收断言

- [ ] Web 首屏不是营销页。
- [ ] 用户可见文案为中文。
- [ ] 工具按钮使用 lucide 图标和中文可访问名称。
- [ ] 长 Session 标题、文件名和消息内容不溢出。
- [ ] `data-testid="workspace-shell"`、`chat-panel`、`message-composer`、`artifact-panel` 可用于 E2E。

## 6. 不做

- 不实现完整代码编辑器。
- 不实现多人真人协作。
- 不把 Runtime 名称作为聊天参与者。
- 不实现平台 Provider 凭证管理。

## 7. Definition of Done

- [ ] Web 工作台符合 `research/ui-design-system.md` 三栏布局。
- [ ] 核心组件复用 UI 基础设施。
- [ ] Web E2E 覆盖功能、截图、布局和敏感信息断言。
- [ ] 与 `FR-UI-001` 冲突的英文文案、毛坯样式和营销首页入口被移除或降级。
