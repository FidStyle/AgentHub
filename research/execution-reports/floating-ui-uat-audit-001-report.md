# FLOATING-UI-UAT-AUDIT-001 — AgentHub Web Floating UI / Overlay 真实浏览器缺口审计报告

> 任务类型：只读审计（不 execute、不修代码、不提交产品改动、不提交 refer_proj、禁止 `git add .`）。
> 审计目标：发现 AgentHub Web tooltip / dropdown / popover / role picker / workspace selector / mobile drawer / artifact overlay / agent panel / composer toolbar 等浮层/入口/按钮的定位与裁切问题。
> 审计日期：2026-05-31。
> 判定红线：禁止用 `toBeVisible` 代替几何断言；每个目标必须真实 hover/focus/click 打开并采集 trigger + floating boundingBox。
> 参考：`UI-TOOLTIP-POSITION-001`（packages/ui Tooltip 已 portal+flip+max-width，作为正向母版对照）。

---

## 1. 审计方法（真实环境）

| 维度 | 真实环境 |
| --- | --- |
| 浏览器 | 真实 Chromium（Playwright），覆盖 1440×900 / 1280×800 / 768×900 |
| DB | 真实 Postgres `agenthub_p0_test`（docker），非 mock |
| Auth | 真实 Auth.js DB session cookie（`ensureP0StorageState`），非 mock |
| 入口 | 真实 `localhost:3000`（`pnpm dev:web` + P0 harness env） |
| 数据 | 通过真实 `/api/workspaces`、`/api/role-agents` 播种 workspace + role agents，确保 dropdown/picker 有真实选项 |

证据采集器：`e2e/tests/web/floating-ui-uat-audit.spec.ts`（只读观察 spec，对每个浮层真实 hover/focus/click 打开，采集 trigger bbox + floating bbox，做几何断言；观察结果归档至 `floating-ui-uat-audit-001-findings.json`）。

> 说明：本审计不修改任何产品代码。spec 是只读证据采集器；几何断言而非 `toBeVisible`。

### 视口矩阵

| 视口 | 模拟场景 | 布局分支 |
| --- | --- | --- |
| 1440×900 | 桌面宽屏 | `lg:grid-cols-[280px_minmax(480px,1fr)_320px]` 三栏 |
| 1280×800 | 桌面窄屏 | 同上三栏（主区被压到 ~440px） |
| 768×900 | 平板/移动 | 单栏 + 移动抽屉（sidebar / artifact `fixed` overlay） |

---

## 2. 审计目标矩阵（静态走查 → 真实浏览器待测）

> 静态走查（步骤 0）已定位实现方式与疑似错位点；几何数据 + 截图 + 最终影响等级由步骤 2 真实浏览器采集后填入第 4 节与 findings.json。

| # | 浮层/入口 | 组件:行 | 实现方式 | 定位策略 | portal | flip/shift | max-w/max-h | z-index | 疑似问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | tooltip（新建会话/打开导航/@角色/附件/发送/切换面板/关闭面板） | `packages/ui/src/components/tooltip.tsx:60` | 自研 `Tooltip` | `computePosition` flip + clamp | ✅ body | ✅ flip+clamp | ✅ `max-w-[16rem] break-words` | `z-50` | 母版对照（UI-TOOLTIP-POSITION-001 已修），复测确认无回归 |
| D1 | workspace selector 下拉 | `apps/web/components/workspace/Sidebar.tsx:54` | 裸 `absolute` div | `absolute left-2 right-2 top-full` | ❌ 无 portal | ❌ 无 flip/shift | ❌ 无 max-height/scroll | `z-10` | 选项多时向下溢出视口/无滚动；嵌在 `border-b` header 内若祖先 overflow 裁切；z-10 偏低 |
| D2 | role picker（@角色） | `apps/web/components/workspace/ChatPanel.tsx:96` | 裸 `absolute` div | `absolute bottom-full left-0` | ❌ 无 portal | ❌ 无 flip/shift | ⚠️ `min-w-40` 无 max-w | `z-10` | composer 在底部，`bottom-full` 向上展开；角色名长时无换行；composer 工具条 flex 行内可能被裁切；z-10 偏低 |
| O1 | artifact panel overlay（移动抽屉） | `apps/web/components/workspace/WorkspaceShell.tsx:57` | `fixed inset-y-0 right-0` | fixed 右贴边 | n/a（fixed） | n/a | `max-w-[85vw]` | `z-30` | 移动态**无 backdrop**（sidebar 抽屉有 `sidebar-backdrop`，artifact 抽屉无），无点击外部关闭；与 sidebar 抽屉同 `z-30` 同时打开可能层叠歧义 |
| O2 | sidebar drawer（移动抽屉） | `apps/web/components/workspace/WorkspaceShell.tsx:24` | `fixed inset-y-0 left-0` + backdrop | fixed 左贴边 | n/a（fixed） | n/a | `w-[280px]` | `z-30`（backdrop `z-20`） | 实现较规范（fixed inset + backdrop + 点击关闭），复测确认 backdrop 覆盖与无横滚 |
| P1 | agent panel（DetailPanel 编辑/删除） | `apps/web/components/layout/DetailPanel.tsx:32` | 静态 `<aside>` 内联 | 非浮层 | n/a | n/a | n/a | n/a | 非浮层（内联面板）；删除用原生 `confirm()`。非本次几何审计重点，仅记录其不在 workspace 活动路由 |
| C1 | composer toolbar 按钮（@/附件/发送/切换面板） | `apps/web/components/workspace/ChatPanel.tsx:85` | `IconButton` + Tooltip | flex 行 | n/a | n/a | n/a | n/a | 入口按钮本身定位 OK；其 tooltip 见 T1，role picker 见 D2 |
| W1 | CreateWorkspaceDialog | `apps/web/components/workspace/CreateWorkspaceDialog.tsx` | `packages/ui` Dialog | 待读 | 待测 | n/a | n/a | 待测 | 模态弹窗，复测 backdrop `fixed inset-0` 与居中无溢出 |

> 活动路由确认：`/workspace/[id]` → `WorkspaceShell` → `workspace/Sidebar` + `workspace/ChatPanel` + `ArtifactPanel`。`apps/web/components/chat/*` 与 `layout/*` 不在活动 workspace 路由上（疑似遗留/桌面变体），本次几何审计聚焦 `workspace/*` 实际渲染组件。

---

## 3. Reference Findings —— refer_proj 浮层实现规则提炼

> 来源：只读阅读 `refer_proj/cherry-studio`、`refer_proj/sxhxliang__agent-studio`（workspace 内未检出可读浮层源码）、并旁参 `refer_proj/lobehub`、`refer_proj/AionUi`、`refer_proj/siteboon__claudecodeui`、`refer_proj/NitroRCr__AIaW`。**仅提炼规则，未复制代码，不提交 refer_proj。**

### 3.1 各项目浮层栈对照

| 项目 | UI 库 | floating 层 | portal 策略 | collision |
| --- | --- | --- | --- | --- |
| cherry-studio | Ant Design 5 + styled-components | antd Tooltip/Popover/Dropdown 内置 portal；RichEditor slash 菜单用 `@floating-ui/dom`（`computePosition + flip + shift + size + offset + autoUpdate`） | antd 内部 `createPortal(document.body)`；RichEditor 菜单显式 `createPortal(node, document.body)` | antd 内置 + floating-ui `flip/shift/size` |
| lobehub | `@lobehub/ui` + antd-style | MentionMenu 用 `@floating-ui/react`（`useFloating + flip + shift + offset + autoUpdate`）；RichEditor 用 `@floating-ui/dom`；Popover 用 `@lobehub/ui` 的 `PopoverRoot/PopoverPortal/PopoverPositioner` | `createPortal` 到 app root / `PopoverPortal` | floating-ui `flip/shift` |
| AionUi | `@arco-design/web-react` + UnoCSS | SelectionToolbar 用 `@floating-ui/react`（`offset/flip/shift/autoUpdate`）；BtwOverlay 手动 `createPortal(document.body)` | `ReactDOM.createPortal(document.body)` | floating-ui `flip/shift` |
| claudecodeui | 自研 shadcn 风 + Tailwind | 自研 Tooltip（手动 fixed 定位）+ Dialog（`fixed inset-0`） | Dialog 用 `createPortal`；Tooltip fixed 定位 | 手动边界数学 |
| sxhxliang__agent-studio | （workspace 内无可读前端浮层源码） | — | — | — |

### 3.2 提炼规则（Distilled Rules）

| # | 规则 | 依据（项目） | AgentHub 现状对照 |
| --- | --- | --- | --- |
| R1 | **浮层必须 portal 到 `document.body`** 以逃逸 `overflow:hidden/auto` 祖先与 transform stacking context | cherry-studio（antd + RichEditor `createPortal`）、AionUi（`createPortal(body)`）、lobehub（`PopoverPortal`） | ✅ Tooltip 已 portal；❌ **D1 workspace 下拉 + D2 role picker 未 portal**（裸 `absolute`） |
| R2 | **flip：首选位放不下时自动翻到对侧** | cherry-studio/lobehub/AionUi 均用 floating-ui `flip` | ✅ Tooltip 有 flip；❌ D1/D2 无 flip（固定 `top-full`/`bottom-full`） |
| R3 | **shift/clamp：沿主轴平移使浮层保持在视口内** | floating-ui `shift`（三项目）；claudecodeui 手动 clamp | ✅ Tooltip 有 clamp；❌ D1/D2 无 shift |
| R4 | **size/max-height：限制浮层尺寸并使内部滚动，避免长列表溢出视口** | cherry-studio/lobehub `size` middleware | ❌ D1 无 max-height + 无内部滚动；D2 无 max-width（长角色名不换行） |
| R5 | **max-width + 文本换行**：tooltip/popover 约束宽度并 `break-words`/`white-space` | claudecodeui Tooltip、antd 默认 | ✅ Tooltip `max-w-[16rem] break-words`；⚠️ D2 `min-w-40` 无 max-w |
| R6 | **autoUpdate：监听 scroll/resize/refs 变化重算位置** | floating-ui `autoUpdate`（三项目） | ✅ Tooltip 监听 `scroll(true)`+`resize`；❌ D1/D2 不重算（开着时滚动会脱锚） |
| R7 | **placement API（side + align / `bottom-start`）** 显式可配 | floating-ui placement、antd `placement` | ✅ Tooltip `side`+`align`；❌ D1/D2 placement 写死 |
| R8 | **z-index 分层**：tooltip > popover/dropdown > drawer > modal backdrop，统一 token | antd 层级；lobehub token | ⚠️ Tooltip `z-50`，但 D1/D2 仅 `z-10`（低于 tooltip 与抽屉 `z-30`，可能被遮） |
| R9 | **modal/抽屉用 `fixed inset-0` backdrop**，锁 body 滚动，点击外部关闭 | claudecodeui Dialog（`fixed inset-0` + `body.style.overflow='hidden'`） | ✅ sidebar 抽屉有 backdrop；❌ **O1 artifact 抽屉移动态无 backdrop/无外部关闭**；Dialog body-scroll-lock 待测 |
| R10 | **tooltip 触发支持 hover + focus（+ 触屏长按）** | claudecodeui（mouse+touch）；可达性 | ✅ Tooltip hover+focus；移动触屏长按未覆盖（记录为低优先增强） |
| R11 | **虚拟元素/caret 定位**用于 @mention 跟随光标 | cherry-studio/lobehub MentionMenu（caret virtual element） | ❌ D2 role picker 锚在按钮而非输入光标（产品可接受，记录为差异非缺陷） |

---

## 4. 真实浏览器审计发现

> 数据来源：`research/execution-reports/floating-ui-uat-audit-001-findings.json`（14 条，3 视口 × 各浮层目标）。
> 采集器：`e2e/tests/web/floating-ui-uat-audit.spec.ts`（真实 Chromium + 真实 Postgres `agenthub_p0_test` + 真实 Auth.js session；`web-desktop` project，`--workers 1`，三视口实测 3/3 passed）。
> 所有判定基于 boundingBox 几何，未用 `toBeVisible` 充数。截图落盘于 `e2e/artifacts/floating-ui-uat-audit/`。

### 4.1 缺陷汇总（按影响等级）

| 等级 | 数量 | 条目 |
| --- | --- | --- |
| high | 3 | D1 × 3 视口（workspace 下拉越界 + 无内部滚动） |
| medium | 1 | O1（移动 artifact 抽屉无 backdrop/无外部关闭） |
| ok | 10 | T1×3、D2×3、O2×1、GLOBAL-HSCROLL×3（无横滚） |

### 4.2 GAP-001（high）— workspace selector 下拉越界且无内部滚动

| 字段 | 内容 |
| --- | --- |
| DOM selector | `[data-testid="workspace-dropdown"]`（trigger `[data-testid="workspace-switcher"]`） |
| 组件:行 | `apps/web/components/workspace/Sidebar.tsx:54-69` |
| trigger bbox | 1440：`(12,12 255×32)`；1280/768 同量级 |
| floating bbox | 1440：`(8,60 263×4358)`，bottom=4418 > vh=900；1280：`263×4394` bottom=4454 > vh=800；768：`263×4430` bottom=4490 > vh=900 |
| 用户症状 | 工作区较多时下拉列表向下无限延伸（实测 ~4.4k px），底部远超视口且**无内部滚动条**，用户无法滚动看到/选中靠后的工作区；列表把整页撑高 |
| 影响等级 | **high**（核心导航入口，跨全部 3 视口复现） |
| 参考对照 | 违反 R1（未 portal）、R2（无 flip）、R4（无 `size`/max-height + 内部滚动）、R8（`z-10` 偏低） |
| 截图 | `e2e/artifacts/floating-ui-uat-audit/{1440x900,1280x800,768x900}-D1-workspace-dropdown.png` |
| 建议任务 | **FIX-D1** |

### 4.3 GAP-002（medium）— 移动 artifact 抽屉无 backdrop / 无点击外部关闭

| 字段 | 内容 |
| --- | --- |
| DOM selector | `[data-testid="artifact-overlay"]` |
| 组件:行 | `apps/web/components/workspace/WorkspaceShell.tsx:57-64` |
| floating bbox | 768：`(448,0 320×900)`（贴右、满高，几何在视口内） |
| 用户症状 | 移动态 artifact 抽屉 `fixed right-0 z-30` 打开后**无半透明 backdrop、无点击外部关闭**；对照同文件 sidebar 抽屉（`:34-40`）有 `sidebar-backdrop` + onClick 关闭。两抽屉同 `z-30`，若同时打开层叠语义不明 |
| 影响等级 | **medium**（几何不越界，但交互一致性/可关闭性缺陷；移动端易“关不掉”） |
| 参考对照 | 违反 R9（抽屉应有 `fixed inset-0` backdrop + 点击外部关闭 + body scroll lock） |
| 截图 | `e2e/artifacts/floating-ui-uat-audit/768x900-O1-artifact-overlay.png` |
| 建议任务 | **FIX-O1** |

### 4.4 通过项（ok，回归确认）

| 条目 | 结果 | 说明 |
| --- | --- | --- |
| T1 tooltip（新建会话） | 3/3 视口 `64×24` 落在视口内、宽度 ≤ `max-w-[16rem]` | UI-TOOLTIP-POSITION-001 母版无回归 |
| D2 role picker（@角色，含超长角色名） | 3/3 `160×102` 落在视口内、未遮挡触发按钮、长名在 `min-w-40` 内换行不撑爆 | 当前 trigger 位置/视口下几何 OK；**但仍未 portal/flip**（结构性风险见 §2 D2、R1/R2），靠近视口边缘或祖先 overflow 变化时仍会错位，列为预防性 FIX-D2 |
| O2 sidebar 抽屉 | 768 `280×900` 在视口内 + `sidebar-backdrop` 覆盖全视口 | 实现规范（`fixed inset` + backdrop + 外部关闭），作为 O1 的修复母版 |
| GLOBAL 横向滚动 | 3/3 无横滚 | 浮层操作后未撑出横向滚动条 |

---

## 5. 建议修复任务（按影响等级排序）

> 本审计**不修复**；以下为建议任务，供后续 execute 任务领取。统一参考 §3 R1–R9 与 packages/ui Tooltip 母版（portal + computePosition flip/clamp + max-width）。

| 任务 | 等级 | 范围 | 验收（几何，禁 toBeVisible） |
| --- | --- | --- | --- |
| **FIX-D1** | high | `workspace/Sidebar.tsx` workspace 下拉：portal-to-body + flip/shift（参考 Tooltip `computePosition`）+ `max-h` + 内部 `overflow-y-auto` 滚动 + z-index 提升至 popover 层 | 3 视口下 floating bbox 完整落在视口内、超长列表出现内部滚动条而非撑高页面、不引发横滚 |
| **FIX-O1** | medium | `workspace/WorkspaceShell.tsx` artifact 移动抽屉：补 `artifact-backdrop`（`fixed inset-0 z-20 lg:hidden`）+ 点击外部关闭 + 与 sidebar 抽屉 z 分层；可选 body scroll lock | 移动态打开后存在覆盖全视口的 backdrop、点击 backdrop 关闭、与 sidebar 抽屉不同 z |
| **FIX-D2** | low（预防） | `workspace/ChatPanel.tsx` role picker：portal-to-body + flip/shift + `max-w` + `break-words` + z-index 提升 | 模拟 trigger 贴近视口顶/边、或祖先 overflow 时 floating bbox 仍不越界/不被裁切/不遮挡 trigger |
| **FIX-UI-FLOATING（可选收敛）** | — | 抽取共享 `Popover`/`Dropdown` 原语到 `packages/ui`（复用 Tooltip 的 `computePosition` + portal），D1/D2 统一改用 | 三浮层共用一套 portal+flip 实现，消除裸 `absolute` 反模式 |

---

## 6. Tracker / Regression-Ledger 更新建议

> 本审计只输出建议，不直接改 tracker/ledger 正文。

### 6.1 regression-ledger 新增建议（`research/regression-ledger.md` → 当前未关闭项）

```
### REG-20260531-002 — workspace selector 下拉越界且无内部滚动（FLOATING-UI-UAT-AUDIT-001 GAP-001）
| 类型 | bug / UI 浮层定位 / P2（功能可用但导航受损） |
| 优先级 | high（核心导航入口，3 视口复现） |
| 状态 | open |
| 关联 FR/PRD | FR-WEB-001, FR-UI-001；research/product/ui-design-system.md（浮层定位） |
| 关联任务/合同 | FLOATING-UI-UAT-AUDIT-001；母版 UI-TOOLTIP-POSITION-001 |
| 影响功能面 | apps/web/components/workspace/Sidebar.tsx 工作区切换下拉 |
| 发现方式 | 真实浏览器 + 真实 DB/auth 几何审计（floating-ui-uat-audit.spec.ts） |
| 证据 | findings.json D1×3：floating 263×4358/4394/4430，bottom 远超 vh，无内部滚动；截图 *-D1-workspace-dropdown.png |
| 关闭条件 | FIX-D1 portal+flip+max-height 滚动，3 视口几何断言落在视口内 + 内部滚动 |
| 下一步 | execute FIX-D1 |

### REG-20260531-003 — 移动 artifact 抽屉无 backdrop/无外部关闭（GAP-002）
| 类型 | bug / 交互一致性 / P3 |
| 优先级 | medium |
| 状态 | open |
| 影响功能面 | apps/web/components/workspace/WorkspaceShell.tsx artifact 移动抽屉 |
| 证据 | findings.json O1@768：fixed 320×900 无 backdrop（对照 sidebar 抽屉有）；截图 768x900-O1-artifact-overlay.png |
| 关闭条件 | FIX-O1 补 backdrop + 点击外部关闭，移动态几何断言通过 |
| 下一步 | execute FIX-O1 |
```

### 6.2 project-tracker 变更历史新增建议（`research/project-tracker.md`）

```
| 2026-05-31 | FLOATING-UI-UAT-AUDIT-001 | ✅ 只读浮层/Overlay 真实浏览器几何审计完成（analyze→reference-extract→audit→verify，不 execute/不修复）：refer_proj（cherry-studio/lobehub/AionUi/claudecodeui）提炼 R1–R11 浮层规则写入 Reference Findings；真实浏览器三视口（1440/1280/768）几何审计 3/3 passed，14 findings。发现 GAP-001(high) workspace 下拉越界无滚动 ×3 视口、GAP-002(medium) 移动 artifact 抽屉无 backdrop；T1 tooltip 母版无回归。登记 REG-20260531-002(high)/003(medium)。产物：report + findings.json + 只读审计 spec |
```

---

## 7. 审计纪律确认

- [x] 真实 `localhost:3000` + 真实 Postgres `agenthub_p0_test` + 真实 Auth.js session（非 mock）
- [x] 三视口 1440×900 / 1280×800 / 768×900 全覆盖
- [x] 每个浮层真实 hover/focus/click 打开并采集 trigger + floating boundingBox
- [x] 几何断言（越界/裁切/遮挡/横滚/变形），未用 `toBeVisible` 充数
- [x] refer_proj 仅提炼规则（R1–R11），未复制代码、未提交 refer_proj
- [x] 未修改任何产品代码（apps/web、packages/ui 等）
- [x] 仅产出审计文件（report.md + findings.json + 只读审计 spec）
