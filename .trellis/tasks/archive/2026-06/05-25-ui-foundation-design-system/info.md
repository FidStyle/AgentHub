# 实现说明：UI 基础设施与设计系统

## 重点文件候选

- `apps/web/app/globals.css`
- `apps/web/components/ui/*`
- `apps/web/components/*`
- `apps/desktop/src/renderer/components/*`
- `e2e/tests/*`
- `e2e/helpers/*`

实际文件以代码现状为准，动手前必须先读对应目录。

## 实现要点

- 先做最小可复用组件，不做超前抽象。
- 组件样式使用 Tailwind 语义变量。
- 状态色必须语义化：成功、警告、错误、运行中、静默辅助。
- 组件不直接绑定具体业务 API。
- 不要引入 Arco、Ant Design 等第二套主组件库。

## 测试命令候选

- `pnpm test`
- `pnpm --filter @agenthub/web test`
- `pnpm test:e2e`

以仓库实际 scripts 为准；若命令不存在，任务实现时需要同步补充或记录替代命令。
