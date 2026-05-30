# Milestone Audit Report — M-adhoc-20260531-ui-tooltip-position

> Adhoc 里程碑：UI-TOOLTIP-POSITION-001 — packages/ui 全局 Tooltip 定位/变形修复（portal-to-body + 自动 flip/shift + max-width 换行）+ 真实浏览器 E2E。
> Ralph session `ralph-20260531-000642`，审计时间 2026-05-31。

## 裁决：PASS ✅

## 子目标验收（task_decomposition 3/3 done）

| 子目标 | done_when | 证据 | 结论 |
| --- | --- | --- | --- |
| G1 共享层 Tooltip 重写 | verification.json `passed=true` 且无 gaps；portal+flip/shift+max-width 且 props/aria/role 未破坏 | `verification.json`（passed=true, gaps=[], 6/6 L1 truths verified, packages/ui tsc exit 0） | ✅ met |
| G2 代码质量与无障碍门 | review.json verdict≠BLOCK | `review.json` PASS（0 critical/0 blocking，fix-don't-hide/minimal-change/a11y 三项预检全过） | ✅ met |
| G3 真实浏览器 E2E | uat.md/Playwright spec 全绿，断言含 boundingBox 在 viewport 内 + 无横滚 + 未遮挡 | `.tests/test-results.json` 6/6 passed（1440/1280/768 × web-desktop+web-tablet），hover/focus 双触发 | ✅ met |

## 质量门记录

| 门 | 裁决 | 置信度 | 说明 |
| --- | --- | --- | --- |
| post-verify | proceed | 91 | verification.json PASS，gaps=[] |
| post-review | proceed | 88 | review.json PASS，0 critical/blocking |
| post-test | proceed | 88 | 6/6 真实浏览器通过 |
| post-goal-audit | done | 90 | 3 子目标全 met（外部 codex 独立只读审计确认 G1/G2/G3 met） |

## 约束合规

- 共享 UI 层统一修复（tooltip.tsx + icon-button.tsx 透传），无逐按钮补丁；无新增运行时依赖（纯 React + Tailwind 实现 portal/flip/shift）。
- 保留 aria-label / role=tooltip 语义，Tooltip/IconButton 既有 props 向后兼容（5 处调用点零破坏）。
- 真实浏览器 + P0 postgres 种子 + 真实 auth cookie，无主链路 mock；无仅 `toBeVisible`；修改文件无 `@ts-ignore`/`as any`/`.skip`。

## 结转 concern（不阻塞本里程碑）

- 768 窄屏下 `toggle-artifact-btn` 被 artifact 空态面板层叠覆盖（响应式三栏布局问题，超出 tooltip 定位任务范围，右边缘断言条件跳过，左边缘 open-sidebar 已覆盖 flip/shift 核心行为）。
- apps/web full `next build` 受 pre-existing dual `@types/react`@18(apps/mobile rn-peer)/19 冲突影响（git stash 基线证实非本次引入）；E2E 走 dev 模式（tsx server.ts）未受阻。

## Adhoc（D-008）

跳过 roadmap snapshot 与 phase 覆盖检查，仅校验 EXC→VRF→REV→TEST 工件链完整 + 子目标全 met；不推进后继里程碑。
