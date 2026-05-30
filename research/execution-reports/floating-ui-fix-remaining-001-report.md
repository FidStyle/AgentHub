# FLOATING-UI-FIX-REMAINING-001 — 移动 artifact 抽屉 backdrop（FIX-O1）+ role picker portal 预防升级（FIX-D2）执行报告

> 任务：闭环 FLOATING-UI-UAT-AUDIT-001 剩余浮层问题——修复 REG-20260531-003 / GAP-002（移动 artifact 抽屉无 backdrop / 无点击外部关闭），并预防性升级 role picker（FIX-D2）为 portal-to-body。
> 范围：`apps/web/components/workspace/WorkspaceShell.tsx`（FIX-O1）+ `apps/web/components/workspace/ChatPanel.tsx`（FIX-D2）+ 复用更新审计几何测试；不碰 @角色业务逻辑、不回退 FIX-D1。
> 日期：2026-05-31。
> 红线：几何断言（boundingBox），禁止 `toBeVisible` 充数；真实浏览器 + 真实 DB + 真实 Auth.js session。

---

## 1. 缺陷回顾（修复前）

| 字段 | FIX-O1（REG-20260531-003 / GAP-002） | FIX-D2（预防项） |
| --- | --- | --- |
| 组件:行 | `WorkspaceShell.tsx` artifact 移动抽屉（`fixed inset-y-0 right-0 z-30`，与 sidebar 抽屉同 z 且无 backdrop） | `ChatPanel.tsx` MessageComposer role picker（裸 `absolute bottom-full left-0 min-w-40 z-10`） |
| 症状 | 移动态 artifact 抽屉无 backdrop、无点击外部关闭（对照 sidebar 抽屉有 `sidebar-backdrop`），与 sidebar 抽屉同 z(30) 无分层 | 裸 absolute 无 portal/flip/max-width；长角色名/边缘触发存在未来越界/撑爆风险（预防，非已复现） |
| 违反规则 | R9（抽屉 backdrop + 外部关闭 + z 分层） | R1（未 portal）、R2（无 flip）、R5（无 max-width/break-words）、R8（`z-10` 偏低） |

## 2. 修复方案（最小改动，复用 FIX-D1 母版）

### FIX-O1 — `WorkspaceShell.tsx`

| 项 | 实现 |
| --- | --- |
| backdrop | `rightPanelOpen` 时渲染 `data-testid="artifact-backdrop"`（`fixed inset-0 z-20 bg-black/40 lg:hidden`，`onClick` → `setRightPanelOpen(false)`），与 `sidebar-backdrop` 行为对齐 |
| z 分层 | backdrop `z-20` < 抽屉 `z-30`；移动顶栏（app bar）`z-[25]` 介于二者之间——保证导航入口（`open-sidebar`）可点（高于 backdrop），又使打开的抽屉覆盖顶栏（低于抽屉） |
| 桌面零影响 | backdrop `lg:hidden`（display:none，不渲染像素/不拦截），抽屉桌面态仍 `lg:static` 第三栏，三栏 grid 布局不变 |

> 关键：初版仅加 backdrop 即引入回归——全屏 backdrop(z-20) 遮挡移动顶栏的 `open-sidebar` 按钮。先试 `z-40` 反而让顶栏盖住抽屉内 `workspace-switcher`(z-30)；最终定 `z-[25]`（backdrop < 顶栏 < 抽屉）根治。该回归由新增的 O1 硬门禁（点击 backdrop 关闭 + 后续 `open-sidebar` 可点）当场捕获。

### FIX-D2 — `ChatPanel.tsx`

复刻 FIX-D1 `Sidebar.tsx` 的 `WorkspaceDropdown` portal 母版，按 role-picker 语义调整：

| 规则 | 实现 |
| --- | --- |
| R1 portal-to-body | 抽出 `RolePicker` 子组件 `createPortal` 到 `document.body`，逃逸 composer `overflow`/stacking context |
| R2 flip | `computeRolePicker`：比较 trigger 上/下可用空间，**上方优先**（对齐原裸 absolute `bottom-full` 语义），上方不足翻下方 |
| R3 clamp | `left` 在 `[MARGIN, vw-width-MARGIN]` 内夹取 |
| R4 size + 内部滚动 | `maxHeight = min(可用空间, 视口高 60%)` + `overflow-y-auto` |
| R5 max-width + break-words | `width = min(320, vw-2*MARGIN)` + `minWidth:160` + 选项 `break-words`，长角色名换行不撑爆 |
| R6 autoUpdate | `useLayoutEffect` 监听 `scroll(true)` + `resize` 重算位置，cleanup 对称 `removeEventListener` |
| R8 z 分层 | `z-50`（popover 层，高于 sidebar/artifact 抽屉 `z-30`） |
| 外部关闭 | document `pointerdown` 捕获监听，点击 trigger / picker 之外关闭；不使用全屏 backdrop |
| SSR-safe | `mounted && pickerOpen` 才 portal（`useEffect(()=>setMounted(true))`），避免服务端 `document` 引用 |

@角色业务逻辑（`selectedRole` / `setPickerOpen` / `sendMessage(input, selectedRole?.id)` / `useRoleAgents` 拉取）零改动；`triggerRef` 挂在包裹 `<div>`（`IconButton` 为普通函数组件不转发 ref）。

## 3. 测试更新

`e2e/tests/web/floating-ui-uat-audit.spec.ts`：

- **O1 段**从只读 `record` 升级为**回归硬门禁**：移动态必须存在覆盖全视口 `artifact-backdrop`（width≥vw-1 && height≥vh-1）、backdrop z(20) < 抽屉 z(30)、点击 backdrop 后 `artifact-overlay` 关闭（`toHaveCount(0)`）；桌面态断言无可见 backdrop（`:visible` count = 0，`lg:hidden`）。
- **O1 流程前置**：移动态 artifact 抽屉默认开启且带 backdrop 后成为模态遮罩，会拦截下层交互——故先在移动流程开头审计+夹起 O1，再让 T1/D1/D2/O2 在无模态遮罩下交互。
- **D2 段**升级为硬门禁：role-picker portal 渲染、floatingBox 完整在视口内（`inViewport` 无症状）、不裁切、width ≤ `MAX_ROLE_PICKER_WIDTH`(320)、长角色名 break-words 不撑爆、打开后无横滚。几何断言非 `toBeVisible`。
- **D1 段**保持 FIX-D1 既有硬门禁不回退；T1/O2/GLOBAL 保持回归观察。

## 4. 真实浏览器验证（修复后）

| 维度 | 内容 |
| --- | --- |
| 入口 | repo 根 `npx playwright test tests/web/floating-ui-uat-audit.spec.ts --config e2e/playwright.config.ts --project=web-desktop --workers=1`，加载 `docker/.p0-test.env` |
| 浏览器/DB/Auth | 真实 Chromium + 真实 Postgres `agenthub_p0_test`（docker）+ 真实 Auth.js DB session cookie |
| 结果 | **3 passed**（1440×900 / 1280×800 / 768×900） |
| findings.json | `severity: {ok×16}`（修复前 `ok×13 + medium×1`）；O1/D2/D1 三视口全 `ok`、symptoms 空 |
| O1 几何 | 768×900 backdrop 320→覆盖全视口、点击 backdrop 抽屉关闭、backdrop z(20)<抽屉 z(30)；桌面 1440/1280 无可见 backdrop |
| D2 几何 | 三视口 floatingBox 在视口内、width ≤ 320、长角色名 break-words 不撑爆、无横滚、不遮挡 trigger |
| D1 回归 | floating 高 540/480/540、bottom 全在视口内、symptoms 空，未回退 |
| 回归 | T1 tooltip 母版、O2 sidebar 抽屉、GLOBAL 横滚全 ok，无回归 |

证据：`research/execution-reports/floating-ui-uat-audit-001-findings.json`；截图 `e2e/artifacts/floating-ui-uat-audit/{1440x900,1280x800,768x900}-{O1,D2,D1}-*.png`。

## 5. 约束遵守

| 约束 | 状态 |
| --- | --- |
| 不回退 FIX-D1（commit f12371b / Sidebar.tsx WorkspaceDropdown） | ✅ 未触碰 `Sidebar.tsx`，D1 三视口保持 pass |
| 不改 @角色业务逻辑 | ✅ `selectedRole`/`setPickerOpen`/`sendMessage roleAgentId`/`useRoleAgents` 零改动，仅替换浮层定位 |
| 不影响桌面三栏 | ✅ backdrop `lg:hidden`、抽屉 `lg:static`，桌面 grid 布局不变 |
| dual @types/react 处理 | ✅ 该冲突已由 WEB-BUILD-REACT-TYPES-001（REG-20260531-004，根 `.npmrc` hoist-pattern）根治关闭；本任务 web type-check 全绿，未新增类型错误 |
| 几何断言非 toBeVisible | ✅ O1/D2/D1 均基于 boundingBox |

> 说明：上一份 FIX-D1 报告结转的「pre-existing dual `@types/react` 冲突」在本任务前已由 REG-20260531-004 在依赖解析层根治，故本任务不再结转该 concern。

## 6. 台账 / tracker 更新

- `research/regression-ledger.md`：REG-20260531-003 状态 `open` → `closed` + 关闭证据 + 关闭时间。
- `research/project-tracker.md`：新增 `FLOATING-UI-FIX-REMAINING-001` 任务条目 + 变更历史行。

## 7. 纪律确认

- [x] 真实浏览器 + 真实 DB + 真实 Auth.js session（非 mock）
- [x] 三视口 1440/1280/768 全覆盖，几何断言（非 `toBeVisible`）
- [x] 范围仅 FIX-O1 + FIX-D2 + 测试，未碰 @角色业务逻辑、未回退 FIX-D1
- [x] FLOATING-UI-UAT-AUDIT-001 全部 GAP（D1/O1）闭环，findings.json 全 16 ok
- [x] 治理门禁 `scripts/verify-governance-gate.sh FLOATING-UI-FIX-REMAINING-001` 通过；精确 git add + 中文 commit；禁止 `git add .`；git status clean
