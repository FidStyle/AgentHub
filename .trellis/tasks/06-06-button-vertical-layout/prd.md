# 调整窄按钮为纵向排列

## Goal

修复右侧工作台/通知弹层中审批类小按钮横向挤压的问题：这类 `Button size="sm"` 叠加 `flex-1` 后会形成 `h-8 px-3 text-xs flex-1` 的横排布局，在窄容器中可读性和可点击性差。改为上下排列，并把左右 padding 调整为 6px。

## What I already know

* 用户指出形如 `inline-flex ... h-8 px-3 text-xs flex-1` 的按钮应上下排列，左右 padding 为 6。
* 代码中 `packages/ui/src/components/button.tsx` 的 `sm` 尺寸默认是 `h-8 px-3 text-xs`。
* 具体横向挤压点在 `apps/web/components/orchestrator/NotificationBell.tsx` 的通知审批按钮组：两个按钮 `className="flex-1"` 横向排列。
* `apps/web/components/orchestrator/ActionCard.tsx` 的权限卡也使用两列审批按钮，应按同一类审批 UX 一起调整。

## Requirements

* 审批类按钮组改为上下排列。
* 按钮左右 padding 使用 6px，对应 Tailwind `px-1.5`。
* 按钮宽度占满容器，避免横向挤压。
* 不修改全局 Button 默认尺寸，避免影响其它按钮。

## Acceptance Criteria

* [ ] `NotificationBell` 待授权按钮组为纵向排列，按钮 `className` 使用 `w-full px-1.5`。
* [ ] `ActionCard` 待授权按钮组为纵向排列，按钮 `className` 使用 `w-full px-1.5`。
* [ ] 单元/源码契约测试覆盖该布局，防止回退为 `flex-1` 横排。
* [ ] Web lint/type-check/相关测试通过。

## Out of Scope

* 不调整全局 `Button` 组件默认 `sm` 样式。
* 不重构审批状态或后端权限逻辑。

## Technical Notes

* 相关文件：`ActionCard.tsx`、`NotificationBell.tsx`、`apps/web/__tests__/message-markdown.test.ts`。
* 规范：`.trellis/spec/frontend/component-guidelines.md` 的 Permission card 规则。
