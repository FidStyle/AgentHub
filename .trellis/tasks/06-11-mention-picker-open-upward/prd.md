# @提及角色菜单向上展开

## Goal

聊天输入框的「@提及角色」下拉菜单当前写死向下展开（`top-full`）。当输入框置于页面底部时，菜单向下超出视口，角色列表看不全。改为**向上展开**，使置底输入框也能看全所有角色。

## Root Cause（已读代码确认）

`apps/web/components/workspace/ChatPanel.tsx:742` 的 `RolePicker` 组件用手写绝对定位 `absolute left-0 top-full z-50 mt-1 ...`：
- `top-full` = 菜单顶部贴触发容器底边 → 向下展开。
- `mt-1` = 向下偏移 4px。

项目无任何 floating UI 库（无 radix/headlessui/floating-ui/cmdk），纯 Tailwind 绝对定位。

## Approach（固定向上展开，已与用户确认）

将 `RolePicker` 的定位类从向下改为向上：
- `top-full` → `bottom-full`（菜单底部贴触发容器顶边）。
- `mt-1` → `mb-1`（向上偏移 4px）。

其余类（`absolute left-0 z-50 max-h-72 w-80 ...`）不变。这是单处 CSS 类修改，不引入新依赖、不改交互逻辑、不改 `data-testid`。

### Out of Scope
- 不引入 floating-ui 等库做智能翻转（用户选了固定向上）。
- 不改触发逻辑、外部点击关闭、状态管理。
- 移动端无 @提及菜单，不涉及。

## Verification

1. `mcp__ide__getDiagnostics` 检查 `ChatPanel.tsx` 无类型错误。
2. 运行涉及该组件的现有测试：`pnpm --filter @agenthub/web test -- message-markdown`（含 `role-picker` / `mention-role-btn` testid 断言），确认全绿、无 skip。
3. 若可本地起 dev server，在 UI 实测：输入框置底时点 @ 按钮，菜单向上展开且能看全所有角色；不可实测则说明。

## Notes
- 单文件单处改动。参照 `.trellis/spec/frontend/quality-guidelines.md`。
