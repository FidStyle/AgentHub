# FLOATING-UI-FIX-D1-001 — workspace selector 下拉越界修复执行报告

> 任务：修复 REG-20260531-002 / FLOATING-UI-UAT-AUDIT-001 GAP-001（workspace selector 下拉越界且无内部滚动）。
> 范围：仅 `apps/web/components/workspace/Sidebar.tsx` 的 workspace selector 下拉浮层 + 复用更新审计几何测试；不碰 workspace 切换业务逻辑。
> 日期：2026-05-31。
> 红线：几何断言（boundingBox），禁止 `toBeVisible` 充数；真实浏览器 + 真实 DB + 真实 Auth.js session。

---

## 1. 缺陷回顾（修复前）

| 字段 | 内容 |
| --- | --- |
| 缺陷 | REG-20260531-002（high） / GAP-001 |
| 组件:行 | `Sidebar.tsx:54-69`（修复前）裸 `absolute left-2 right-2 top-full z-10` div |
| 症状 | 工作区较多时下拉向下无限延伸（实测 floating 高 ~4358/4394/4430px），bottom 远超视口（4418>900 / 4454>800 / 4490>900），**无内部滚动**，列表把整页撑高，用户无法看到/选中靠后工作区 |
| 违反规则 | R1（未 portal）、R2（无 flip）、R4（无 max-height + 内部滚动）、R8（`z-10` 偏低） |

## 2. 修复方案（最小改动，参考 packages/ui Tooltip 母版）

`Sidebar.tsx` workspace 下拉从裸 `absolute` 改为 portal 浮层，复用母版 Tooltip 的 portal + clamp 思路，并按下拉语义补 size/max-height：

| 规则 | 实现 |
| --- | --- |
| R1 portal-to-body | 抽出 `WorkspaceDropdown` 子组件（与母版 `TooltipContent` 同构），`createPortal` 到 `document.body`，逃逸 sidebar `overflow`/stacking context |
| R2 flip | `computeDropdown`：比较 trigger 上/下可用空间，空间大的一侧展开（下方不足自动翻上方） |
| R3 clamp | `left` 在 `[MARGIN, vw-width-MARGIN]` 内夹取；宽度对齐 trigger |
| R4 size + 内部滚动 | `maxHeight = min(可用空间, 视口高 60%)` + `overflow-y-auto`；长列表内部滚动而非撑高页面 |
| R6 autoUpdate | `useLayoutEffect` 监听 `scroll(true)` + `resize` 重算位置 |
| R8 z 分层 | `z-50`（popover 层，高于 sidebar 抽屉 `z-30`） |
| 外部关闭 | document `pointerdown` 捕获监听，点击 trigger / dropdown 之外关闭；**不使用全屏 backdrop**（避免遮挡并拦截 trigger 二次点击，初版 backdrop 方案因拦截 trigger 关闭点击导致 E2E timeout，已改为 pointerdown 监听） |

业务逻辑（`switchWorkspace` / `fetchSessions` / `/api/workspaces` 拉取 / URL 权威选中）零改动。

## 3. 测试更新

`e2e/tests/web/floating-ui-uat-audit.spec.ts` D1 段从只读 `record` 升级为**回归硬门禁**：除记录 finding 外追加几何硬断言——下拉必须渲染、floatingBox 可测、`symptoms` 为空（无越界/裁切/横滚）、bottom ≤ 视口高。任一不满足即 fail，守护 D1 从 high 回到 pass。其余浮层段保持只读观察。

## 4. 真实浏览器验证（修复后）

| 维度 | 内容 |
| --- | --- |
| 入口 | repo 根 `npx playwright test tests/web/floating-ui-uat-audit.spec.ts --config e2e/playwright.config.ts --project=web-desktop --workers=1`，加载 `docker/.p0-test.env` |
| 浏览器/DB/Auth | 真实 Chromium + 真实 Postgres `agenthub_p0_test`（docker）+ 真实 Auth.js DB session cookie |
| 结果 | **3 passed (8.7s)**（1440×900 / 1280×800 / 768×900） |
| findings.json | `severity: {ok×13, medium×1}`（修复前 `high×3 + medium×1 + ok×10`）；D1 三视口全 `ok`、symptoms 空 |
| D1 几何 | floating 高度 540/480/540（修复前 ~4400），bottom 588/528/588 全在视口内；无横滚 |
| 剩余 medium | O1（移动 artifact 抽屉无 backdrop）= GAP-002 / REG-20260531-003，**本任务范围外**，未触碰 |
| 回归 | T1 tooltip 母版、D2 role picker、O2 sidebar 抽屉、GLOBAL 横滚全 ok，无回归 |

证据：`research/execution-reports/floating-ui-uat-audit-001-findings.json`（generatedAt 2026-05-30T18:27:48Z）；截图 `e2e/artifacts/floating-ui-uat-audit/{1440x900,1280x800,768x900}-D1-workspace-dropdown.png`（下拉有界 + 内部滚动）。

> 说明：`apps/web` 全量 `tsc` 存在 pre-existing dual `@types/react` 冲突（`ReactPortal` not assignable to `ReactNode`，母版 `tooltip.tsx:97` 同款）。本修复抽出的 `WorkspaceDropdown` 沿用母版同构 portal 写法，新增 1 处**同源同类**报错（baseline 4 → 5），非新缺陷；Next.js SWC / E2E dev 模式不受影响（母版 Tooltip 带同款 tsc 报错已通过真实浏览器 E2E）。该全局类型冲突属 DEV-ENV 范畴，超出本任务「仅 workspace dropdown」范围，未在此修复。

## 5. 台账 / tracker 更新

- `research/regression-ledger.md`：REG-20260531-002 状态 `open` → `closed` + 关闭证据 + 关闭时间。
- `research/project-tracker.md`：新增 `FLOATING-UI-FIX-D1-001` 任务条目 + 变更历史行。

## 6. 纪律确认

- [x] 真实浏览器 + 真实 DB + 真实 Auth.js session（非 mock）
- [x] 三视口 1440/1280/768 全覆盖，几何断言（非 `toBeVisible`）
- [x] 范围仅 workspace selector 下拉 + 测试，未碰业务逻辑、未碰其他浮层（D2/O1 留待后续）
- [x] D1 从 high → pass，findings.json 实测刷新
- [x] 治理门禁 `scripts/verify-governance-gate.sh FLOATING-UI-FIX-D1-001` 通过；精确 git add + 中文 commit；禁止 `git add .`；git status clean
