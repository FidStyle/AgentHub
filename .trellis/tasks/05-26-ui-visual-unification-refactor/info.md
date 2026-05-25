# 实现说明：三端 UI 视觉统一返工

## 重点文件候选

- `packages/ui/src/*`
- `apps/web/app/globals.css`
- `apps/web/components/workspace/*`
- `apps/web/components/ui/*`
- `apps/web/app/m/*`
- `apps/desktop/src/renderer/*`
- `e2e/helpers/*`
- `e2e/tests/*`
- `e2e/artifacts/*`

实际文件以代码现状为准，动手前必须先读目录和现有实现。

## 执行顺序

1. 读取 `research/ui-design-system.md` 第 3 章统一视觉母版。
2. 审计当前三端截图和页面实现，记录视觉割裂点。
3. 先补统一母版断言、截图对照和敏感字段断言。
4. 修正共享 token 和核心组件。
5. 替换 Web、Desktop、Mobile/PWA 的临时样式。
6. 跑局部 E2E 和截图对照，失败就继续修。
7. 仍有需求不清时，生成 `research/prd-amendments/*.md` 并暂停。

## 测试命令候选

- `pnpm test`
- `pnpm test:e2e`
- `pnpm test:e2e:desktop`
- `pnpm lint`
- `pnpm typecheck`

以仓库实际 scripts 为准。命令不存在时，先读取 `package.json` 和 `e2e` 配置，补充或记录等价命令。

## 风险

- 不能为了统一视觉，把三端职责做成完全一样。
- 不能为了参考 Desktop，把本地 Runtime 做成 API Key Provider 表单。
- 不能只靠截图留存，必须有可自动失败的布局和母版断言。
