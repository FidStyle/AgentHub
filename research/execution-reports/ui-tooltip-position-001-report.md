# UI-TOOLTIP-POSITION-001 执行报告

> 任务：修复 AgentHub 全局 Tooltip 定位/变形问题（packages/ui 共享层）+ 真实浏览器 E2E。
> Ralph session：`ralph-20260531-000642`（13 步全闭环）。日期：2026-05-31。

## 1. 问题背景

`packages/ui` 旧 Tooltip 使用 `absolute bottom-full left-1/2 -translate-x-1/2 + whitespace-nowrap`：
- 被祖先 `overflow` 容器裁切；
- 在 viewport 边缘 / 移动窄屏越界、错位、被裁切；
- `whitespace-nowrap` 导致长文案不换行、横向拉伸变形并可能引发横向滚动。

影响 workspace 全部 IconButton（新建会话 / @角色 / 发送 / 打开侧栏 / 切换面板）。

## 2. 修复方案（shared UI 层统一，禁止逐按钮补丁）

`packages/ui/src/components/tooltip.tsx` 重写：
- **portal-to-body**：`createPortal(..., document.body)` 脱离 overflow 容器裁切；
- **side/align + 自动 flip/shift**：`computePosition` 用 `fits()` 检测首选边 → 不 fit 翻转到对侧 → 仍越界用 `Math.max/min` clamp 平移回 viewport（GAP=6 / MARGIN=8）；
- **max-width + 换行**：`max-w-[16rem] break-words`，物理移除变形根因 `whitespace-nowrap`；
- **语义保留**：`role=tooltip` + `aria-describedby`（仅 open 挂载）+ hover/focus 双触发。

`packages/ui/src/components/icon-button.tsx`：新增可选 `tooltipSide`/`tooltipAlign` props 透传，5 处既有调用点未传入 → 回退 `top`/`center`，零破坏向后兼容。

无新增运行时依赖（纯 React + 现有 Tailwind）。

## 3. 验证证据

| 阶段 | 工件 | 结论 |
| --- | --- | --- |
| verify | `.workflow/scratch/20260531-verify-ui-tooltip-position/verification.json` | passed=true, gaps=[], 6/6 L1 truths verified, packages/ui tsc exit 0 |
| review | `.workflow/scratch/20260531-review-ui-tooltip-position/review.json` | verdict=PASS, 0 critical/0 blocking, fix-don't-hide/minimal-change/a11y 预检全过 |
| test | `.workflow/scratch/20260531-review-ui-tooltip-position/.tests/test-results.json` | **6/6 passed**（1440/1280/768 × web-desktop+web-tablet） |

E2E：`cd e2e && npx playwright test tests/web/ui-tooltip-position.spec.ts`（真实 web dev server + P0 postgres + 真实 DB session cookie），断言 tooltip boundingBox 完整落在 viewport 内、未裁切、未遮挡触发按钮、max-width 约束、无横向滚动、hover+focus 双触发。

测试期修复 3 个真实测试缺陷（均为测试前置/harness 问题，非组件缺陷）：
1. `send-btn` 需先输入文本才能聚焦（disabled 按钮不可获键盘焦点）；
2. hover 前 `page.mouse.move(0,0)` 复位指针，确保 mouseenter 重发；
3. 768 折叠抽屉先 `open-sidebar` 再建会话、backdrop `force` 点击 + `waitFor detached`、toggle 仅在 `elementFromPoint` 可命中时测 hover。

## 4. 质量门记录

| 门 | 裁决 | 置信度 |
| --- | --- | --- |
| post-verify | proceed | 91 |
| post-review | proceed | 88 |
| post-test | proceed | 88 |
| post-goal-audit | proceed（3/3 子目标 met，外部 codex 独立只读审计确认） | 90 |
| milestone-audit | PASS | — |

## 5. 结转 concern（不阻塞）

- 768 窄屏 `toggle-artifact-btn` 被 artifact 空态面板层叠覆盖（响应式三栏布局问题，超出 tooltip 定位任务范围，右边缘断言条件跳过，左边缘 `open-sidebar` 已覆盖 flip/shift 核心行为）。
- apps/web full `next build` 受 pre-existing dual `@types/react`@18(apps/mobile rn-peer)/19 冲突（git stash 基线证实非本次引入）；E2E 走 dev 模式未受阻。

## 6. 关闭

REG-20260531-001 已关闭，归档 adhoc milestone `M-adhoc-20260531-ui-tooltip-position`。
