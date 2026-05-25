# 三端视觉 E2E 门禁

## 1. 目标

建立 Web、Mobile/PWA、Electron Desktop 的统一视觉 E2E 门禁，确保 UI 不再停留在 `toBeVisible` 浅层检查。

## 2. 绑定需求

- `FR-UI-001`
- `FR-WEB-001`
- `FR-DESK-001`
- `FR-MOB-001`

## 3. 范围

### 必须覆盖

- Web 桌面：1440x900、1024x768。
- Mobile/PWA：390x844。
- Electron Desktop：1200x800。
- 截图留存。
- 无横向滚动。
- 关键容器 bounding box 不重叠。
- 长文本不溢出父容器。
- 三端同状态截图能看出共享色板、圆角、按钮、Badge、消息气泡、输入框和状态卡来自同一视觉母版。
- 关键页面使用共享 token 或共享组件体系，不能绕开设计系统临时堆样式。
- 本地 Runtime UI 不出现 API Key、Base URL、敏感环境变量入口。

### 不做

- 不接入 Percy/Chromatic 等外部云服务。
- 不引入 Maestro/Appium，除非后续进入原生移动壳。
- 不用视觉测试替代业务功能断言。

## 4. TDD 与测试计划

### 先写 helper

- `expectNoHorizontalOverflow(page)`。
- `expectNoOverlap(locatorA, locatorB)`。
- `expectTextContained(locator)` 或等价文本溢出断言。
- `expectNoSensitiveRuntimeCredentialFields(page)`。
- `expectUsesUnifiedVisualSystem(page)` 或等价断言，检查核心页面存在共享 token/组件标记或稳定的统一母版 class。
- `captureCrossSurfaceComparison(page, surface, state)`，按 Web/Desktop/Mobile 同状态留存对照截图。
- `captureStableScreenshot(page, name)` 或统一截图约定。

### E2E 用例

- Web 工作台截图和布局断言。
- Mobile/PWA 会话、审批、预览截图和布局断言。
- Desktop Connector Console 截图和布局断言。
- Web/Desktop/Mobile 同状态截图对照和统一母版断言。
- 本地 Runtime 凭证边界跨端断言。

## 5. Definition of Done

- [ ] `test:e2e` 覆盖 Web 和 Mobile/PWA 项目。
- [ ] `test:e2e:desktop` 覆盖 Electron Desktop。
- [ ] 三端关键页面有截图留存。
- [ ] 所有核心 UI 用例包含布局断言和敏感信息断言。
- [ ] 所有核心 UI 用例包含统一视觉母版断言。
- [ ] 截图产物能按同状态对照 Web、Desktop、Mobile，而不是分散截图。
- [ ] 测试失败时能定位到具体页面、状态和断言原因。
