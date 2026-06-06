# 修正工作台 tab 图标文字排列

## Goal

修正右侧工作台顶部 tab 按钮的视觉布局：用户指出目标不是审批按钮组，而是 `artifact-tab-*` 按钮内部的 SVG 图标和 tab 文案需要上下排列，左右 padding 为 6px。

## What I already know

* 目标按钮示例：`data-testid="artifact-tab-角色"`，当前由 `ArtifactPanel.tsx` 渲染。
* 当前实现为 `Button size="sm" className="flex-1"`，图标使用 `mr-1`，因此 SVG 和文字横向排列。
* 上一次误改了 `ActionCard` 与 `NotificationBell` 审批按钮布局，需要还原。

## Requirements

* 右侧工作台 tab 按钮内部改为图标在上、文字在下。
* tab 按钮左右 padding 使用 6px，对应 Tailwind `px-1.5`。
* 图标不能再使用 `mr-1`，应独立居中。
* 保留 tab 按钮横向分布和 `flex-1` 宽度分配。
* 还原审批按钮组到之前横向布局，不把上次误解作为产品改动保留。

## Acceptance Criteria

* [ ] `ArtifactPanel` 的 `artifact-tab-*` 按钮 class 包含 `flex-col` 和 `px-1.5`。
* [ ] tab 图标 class 不再使用 `mr-1`。
* [ ] `ActionCard` 审批按钮恢复 `grid grid-cols-2 gap-2`。
* [ ] `NotificationBell` 审批按钮恢复横向 `flex gap-2` 和 `flex-1`。
* [ ] 相关源码契约测试更新并通过。
* [ ] Web lint/type-check 通过。

## Out of Scope

* 不改变 tab 数量、顺序、选中逻辑或右侧工作台数据逻辑。
* 不调整全局 Button 组件默认样式。

## Technical Notes

* 相关文件：`apps/web/components/workspace/ArtifactPanel.tsx`、`ActionCard.tsx`、`NotificationBell.tsx`、`apps/web/__tests__/message-markdown.test.ts`。
