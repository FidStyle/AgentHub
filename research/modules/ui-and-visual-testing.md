# 模块调研：三端 UI 设计系统与视觉 E2E

**日期：** 2026-05-25  
**状态：** 已收敛  
**覆盖 FR-ID：** `FR-UI-001`, `FR-DEVICE-001`, `FR-WEB-001`, `FR-DESK-001`, `FR-MOB-001`, `FR-CHAT-001`, `FR-RESULT-001`, `FR-PERM-001`  
**相关文档：** `research/ui-design-system.md`, `research/technical-design.md`, `.trellis/spec/frontend/ui-style-guidelines.md`

---

## 1. 调研问题

用户明确要求三端 P0 不能交付“毛坯房 UI”，并且要参考已有项目的界面风格。该模块需要回答：

1. Web、Desktop、Mobile/PWA 是否能用同一套组件审美覆盖。
2. 主组件库应该采用什么方案。
3. AionUi、codeg、lobehub、cherry-studio 各自借鉴什么，不借鉴什么。
4. 多端 E2E 是否用一个工具覆盖，还是按端分层。
5. 如何让后续 `.trellis/tasks/*/` 实现任务强制遵循 UI 契约。

---

## 2. UI 参考项目分析

| 参考项目 | 可借鉴点 | 不采用点 | 结论 |
| --- | --- | --- | --- |
| AionUi | 高密度聊天工作台、聊天与预览分栏、紧凑工具条、Agent 卡片 | 不直接采用 Arco 作为主组件库，不复制完整设置体系 | 作为 Web 工作台密度和 Agent 卡片主参考 |
| codeg | shadcn 风格侧栏、会话壳、输入框工具条、权限弹窗、lucide 图标使用 | 不采用过度 IDE 化堆叠，不保留英文 UI 文案 | 作为组件风格和交互主参考 |
| lobehub | 移动会话布局、设置分组、模型状态表达 | 不引入重型模型供应商配置作为 P0 主流程 | 作为 Mobile/PWA 辅参考 |
| cherry-studio | 桌面应用信息密度、设置分组、Provider/Agent 管理参考 | 不把本地 Claude Code / Codex 做成 API Key Provider 表单 | 作为 Desktop Connector 辅参考 |

---

## 3. 组件与样式方案矩阵

| 方案 | 优点 | 风险 | 多端适配 | 协议/许可关注 | 结论 |
| --- | --- | --- | --- | --- | --- |
| shadcn/ui + Tailwind CSS 4 + lucide-react | 与当前 Web Tailwind 4 方向一致；组件可复制进项目；codeg 风格贴近；Web/PWA/Electron renderer 都能覆盖 | 需要自己维护组件一致性和设计变量 | 高：React DOM、Next.js、Electron renderer、PWA 都适配 | shadcn/ui 组件源码进入项目后需遵守对应组件依赖许可；lucide 为开源图标 | 采用 |
| Arco Design | AionUi 风格接近，组件完整 | 与当前 Tailwind 体系割裂；视觉容易变成 Arco 默认味道；PWA/桌面定制成本高 | 中 | 需要引入较重组件库 | 不采用为主库，仅参考 AionUi 布局 |
| Radix UI 原语自研 | 可控性强，可构建高质量组件 | P0 成本高，需要补大量样式和组件封装 | 高 | 依赖许可友好 | 作为 shadcn 底层思想，不单独自研 |
| Ant Design | 企业组件完整，表单成熟 | 风格偏后台管理，聊天工作台和移动端会显笨重 | 中 | 引入体积和风格成本 | 不采用 |
| Headless UI + Tailwind | 轻量、可定制 | 组件覆盖不如 shadcn，仍需较多封装 | 中高 | 许可友好 | 备选，不作为 P0 主路线 |

**收敛结论：** 采用 `shadcn/ui + Tailwind CSS 4 + lucide-react`。该方案可以覆盖 Web、Desktop Electron renderer 和 Mobile/PWA。AionUi/Arco 只作为布局和密度参考，不作为组件库路线。

---

## 4. E2E 与视觉测试工具矩阵

| 工具 | 适用端 | 优点 | 风险 | CI 适配 | 结论 |
| --- | --- | --- | --- | --- | --- |
| Playwright browser projects | Web、Mobile/PWA | 仓库已有基础配置；支持截图、设备视口、定位、网络 mock、布局断言 | 对真实原生移动壳覆盖不足 | 高 | P0 Web/Mobile 主工具 |
| Playwright Electron | Electron Desktop | 可真实启动 Electron renderer，适合 Connector Console 截图和断言 | 需要稳定构建 desktop main/renderer | 中高 | P0 Desktop 主工具 |
| Maestro | 原生移动 App、Capacitor 包装壳 | 移动真机/模拟器流程简洁 | P0 Mobile 是 PWA，过早引入会增加工具链负担 | 中 | P1/P2 原生壳再评估 |
| Appium | 原生移动、跨平台自动化 | 覆盖面广 | 配置重、测试慢、P0 投入不划算 | 中低 | 不作为 P0 |
| Storybook + 视觉回归 | 组件级视觉 | 适合组件状态矩阵 | 当前仓库未建立 Storybook，P0 可能分散精力 | 中 | P1 可补 |
| Percy/Chromatic | 云端视觉基线 | 视觉 diff 成熟 | 需要外部服务和账号，可能影响交付 | 中 | P0 不依赖 |

**收敛结论：**

- Web 桌面和 Mobile/PWA 使用 Playwright browser projects。
- Desktop 使用 Playwright Electron。
- P0 不用一个黑盒工具覆盖所有端；按端选择成熟工具流。
- Maestro/Appium 只在进入 Capacitor 或原生移动壳后再评估。

---

## 5. 视觉 E2E 断言策略

P0 的视觉测试不是只保存截图，还必须包含可自动判定的布局断言：

| 断言 | 目的 | 适用端 |
| --- | --- | --- |
| `document.body.scrollWidth <= window.innerWidth + 1` | 防止横向破版 | Web、Mobile/PWA |
| bounding box 不重叠 | 防止卡片、输入框、侧栏互相覆盖 | 三端 |
| 长文本不溢出父容器 | 防止中文标题、文件名、路径摘要撑破布局 | 三端 |
| 固定格式组件尺寸稳定 | 防止 loading、running、disabled 状态造成跳动 | 三端 |
| 截图留存 | 供人工评审和后续回归 | 三端 |
| 敏感信息不存在 | 防止 API Key、环境变量、本地路径进入 UI 或截图 | 三端 |

推荐关键定位点已经写入 `.trellis/spec/frontend/ui-style-guidelines.md`。

---

## 6. 后续执行约束

为保证调研结论进入执行阶段，本模块结论已经落到三层文档：

1. `research/prd.md`：新增 `FR-UI-001`，把 UI 视觉与交互契约纳入 Requirement Registry。
2. `research/ui-design-system.md`：定义三端布局、组件规格、状态视觉、禁止项和视觉 E2E 门禁。
3. `.trellis/spec/frontend/ui-style-guidelines.md`：把实现层规范写入 Trellis，供后续任务自动读取。

后续 `.trellis/tasks/*/` 如果涉及 UI，必须：

- 绑定业务 `FR-ID` 和 `FR-UI-001`。
- 引用 `research/ui-design-system.md` 与 `.trellis/spec/frontend/ui-style-guidelines.md`。
- 写明参考项目来源。
- 先写测试规划，包含功能断言、截图断言、布局断言和敏感信息断言。

---

## 7. 最终路线

| 模块 | P0 路线 |
| --- | --- |
| 组件与样式 | `shadcn/ui + Tailwind CSS 4 + lucide-react` |
| Web 视觉参考 | AionUi 聊天/预览分栏 + codeg 侧栏/会话壳/输入框 |
| Desktop 视觉参考 | cherry-studio 桌面密度 + AgentHub Connector Console 产品边界 |
| Mobile/PWA 视觉参考 | lobehub 移动会话布局 + AgentHub 轻量审批/预览边界 |
| Web/Mobile E2E | Playwright browser projects |
| Desktop E2E | Playwright Electron |
| 视觉门禁 | 截图 + bounding box + 无横向滚动 + 文本不溢出 + 敏感信息断言 |
