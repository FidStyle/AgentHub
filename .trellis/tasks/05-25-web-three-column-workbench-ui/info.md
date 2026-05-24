# 实现说明：Web 三栏 IM 工作台视觉重构

## 重点文件候选

- `apps/web/app/page.tsx`
- `apps/web/app/(workspace)/**`
- `apps/web/components/chat/ChatPanel.tsx`
- `apps/web/components/**`
- `e2e/tests/workspace.spec.ts`
- `e2e/tests/messaging.spec.ts`

实际实现前先搜索当前路由和组件，避免覆盖已有业务逻辑。

## 开发顺序

1. 先补 Web 工作台 E2E 骨架和断言。
2. 替换营销式首页或毛坯工作台入口。
3. 重构三栏布局和输入框工具条。
4. 接入计划卡、审批卡、结果卡的视觉结构。
5. 补截图和布局断言。

## 风险

- 当前 UI 可能已有业务 mock，不应删除可用数据流。
- 不要把 Desktop Connector 状态做成本地执行入口；Web 只能控制，不能执行本地动作。
