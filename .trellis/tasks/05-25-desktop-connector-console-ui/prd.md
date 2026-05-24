# Desktop Connector Console 视觉重构

## 1. 目标

把 Electron renderer 重构为真正的 Desktop Connector Console，聚焦设备连接、本地 Workspace、Runtime 检测、执行活动和待审批。

## 2. 绑定需求

- `FR-DESK-001`
- `FR-RUNTIME-001`
- `FR-ACTION-001`
- `FR-NOTIFY-001`
- `FR-UI-001`

## 3. Desktop UI 模块

| 模块 | 要求 |
| --- | --- |
| 顶部状态条 | 登录用户、设备名、在线状态、最后心跳 |
| Workspace 绑定 | 授权目录、目录健康状态、打开 Web 工作台入口 |
| Runtime 检测 | Claude Code/Codex 安装、版本、原生认证状态、能力声明 |
| 执行活动 | 最近 Runtime/Action 请求、状态、失败原因、重试或详情 |
| 待审批 | 设备相关审批、高风险动作确认 |

## 4. UI 参考

- cherry-studio：桌面应用密度和设置分组。
- AionUi：状态卡和 Agent 卡片信息层级。
- codeg：权限弹窗和图标按钮。

## 5. TDD 与测试计划

### 先写测试

- Electron E2E：启动窗口后显示 `connector-console`。
- Runtime 状态卡测试：Claude Code/Codex 显示安装、版本、认证状态。
- 凭证边界测试：页面不存在 `API Key`、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、`Base URL` 输入框。
- 离线状态测试：Connector 离线时本地执行入口不可用，并显示中文修复提示。
- 视觉断言：1200x800 下状态卡不重叠、无横向滚动。

## 6. 不做

- 不复制 Web 三栏工作台。
- 不提供本地 Claude Code/Codex App 内登录。
- 不保存本地 CLI API Key、Base URL 或敏感环境变量。
- 不让 Electron renderer 直接访问文件系统或 shell。

## 7. Definition of Done

- [ ] Desktop 首页是 Connector Console。
- [ ] Runtime 检测和本机修复引导清晰。
- [ ] 本地 Runtime 凭证边界通过 E2E 断言。
- [ ] Electron 视觉截图和布局断言进入测试。
