# M17 TDD 验证补全 - 分析上下文

## 当前状态总结

### 已完成基础设施 (M11-M15 code-complete)

**packages/ui 设计系统组件 (M11)**:
- Button, Card, Input, Badge, Dialog, Tooltip, IconButton, StateCard 共 8 个组件
- globals.css 使用 oklch 语义色变量 + Tailwind CSS 4 @theme
- StateCard 覆盖 8 个状态变体（缺 "offline" 和 "not-logged-in" 两个主态）
- 圆角变量: sm=0.25rem, md=0.5rem, lg=0.75rem

**E2E 测试框架 (M15)**:
- playwright.config.ts: web-desktop(1440x900), web-tablet(1024x768), mobile-pwa(390x844)
- playwright.desktop.config.ts: Electron 独立配置
- helpers/visual-assertions.ts: assertNoHorizontalScroll, assertNoElementOverlap, assertNoTextOverflow, assertNoSensitiveFields

**Web 三栏工作台测试 (M12)**:
- web-workbench.spec.ts: 三栏渲染、消息输入、会话切换、右栏折叠
- web/visual-gate.spec.ts: 1440x900 + 1024x768 无横滚/不重叠/无敏感字段/截图

**Desktop Connector Console 测试 (M13)**:
- desktop/connector-console.spec.ts: 定位点、状态条、无API Key输入、无横滚
- desktop/electron.spec.ts: 启动、定位点、Runtime检测
- desktop/visual-gate.spec.ts: 无横滚、状态卡不重叠、无敏感字段、截图

**Mobile/PWA 测试 (M14)**:
- mobile/mobile-pwa.spec.ts: 定位点、无横滚、中文UI、审批导航
- mobile/visual-gate.spec.ts: 无横滚、标题不溢出、无敏感字段、截图

### 差距分析 (对照 roadmap.md M17 验收标准)

#### Phase 1 差距: 设计系统 TDD 验证
| 验收项 | 状态 | 差距 |
|--------|------|------|
| 每个基础组件有 Playwright 渲染测试 | ❌ 部分 | 仅 StateCard 有隐式测试；Button/Card/Input/Badge/Dialog/IconButton 缺独立渲染测试 |
| 设计变量在三端主题中生效且有断言 | ❌ 缺失 | 无 CSS 变量值断言 |
| 状态组件覆盖所有 9 种状态 | ⚠️ 差 2 | StateCard 有 8 种，缺 `offline` 和 `not-logged-in`（PRD 定义 9 种） |
| StateCard 不出现敏感信息 | ✅ | assertNoSensitiveFields 已覆盖 |
| lucide 图标按钮有中文 aria-label | ⚠️ 浅 | 有测试但只检查 aria-label 非空，未验证中文 |
| E2E 定位点存在且可定位 | ⚠️ 部分 | workspace-shell/chat-panel 有测试，其他定位点未验证 |
| 截图保存至 e2e/artifacts/design-system/ | ❌ | 截图存至 artifacts/ 根目录，无 design-system/ 子目录 |

#### Phase 2 差距: 三端页面 TDD 验证
| 验收项 | 状态 | 差距 |
|--------|------|------|
| Web 1440x900 三栏不重叠 | ✅ | visual-gate.spec.ts 已覆盖 |
| Web 1024x768 右栏收起无横滚 | ⚠️ | 有无横滚测试，缺右栏收起断言 |
| Desktop 1200x800 connector-console 存在 | ✅ | connector-console.spec.ts |
| Desktop 无 API Key/Base URL | ✅ | 已测试 |
| Mobile 390x844 无横滚 | ✅ | mobile-pwa.spec.ts |
| 所有 UI 文字简体中文 | ⚠️ | 有个别中文断言，缺全局英文文案扫描 |
| 计划卡/审批卡/任务结果卡截图+布局断言 | ❌ | 缺专项测试 |

#### Phase 3 差距: refer_proj 对照审计
| 验收项 | 状态 | 差距 |
|--------|------|------|
| 对照 AionUi/codeg/lobehub/cherry-studio | ❌ | 完全未进行 |
| 差距报告 | ❌ | 未生成 |

## Locked Decisions

1. **Tailwind CSS 4 + @tailwindcss/vite** — 已确认工作，不回退
2. **Playwright 三项目配置** — web-desktop/web-tablet/mobile-pwa + Electron 独立
3. **StateCard 8 变体** — 已实现，可能需扩展到 9（待确认 PRD 定义）
4. **assertNoSensitiveFields** — 已含 API Key/Base URL/sk- 检测
5. **中文 UI 文案** — 所有组件默认中文

## Free Decisions

1. 缺失的组件渲染测试用什么粒度：独立 story 页 vs 组合页面
2. CSS 变量断言策略：getComputedStyle vs snapshot
3. 9 种状态中 offline/not-logged-in 是否需要单独 StateVariant 还是复用现有

## Deferred

1. refer_proj 对照标准的具体量化指标（Phase 3 处理）

## 执行建议

scope_verdict: medium

按 M17 Phase 1→2→3 顺序执行：
1. Phase 1: 补全组件渲染测试 + CSS 变量断言 + 扩展 StateCard + 截图目录
2. Phase 2: 补全三端深度交互测试 + 中文文案扫描 + 计划卡/审批卡/结果卡测试
3. Phase 3: 读取 refer_proj 源码对照实现，生成 gap report
