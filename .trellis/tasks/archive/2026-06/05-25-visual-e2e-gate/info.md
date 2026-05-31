# 实现说明：三端视觉 E2E 门禁

## 重点文件候选

- `e2e/playwright.config.ts`
- `e2e/playwright.desktop.config.ts`
- `e2e/tests/workspace.spec.ts`
- `e2e/tests/messaging.spec.ts`
- `e2e/tests/desktop/electron.spec.ts`
- `e2e/helpers/*`

## 开发顺序

1. 增加或整理 Playwright projects：desktop web、mobile web。
2. 新增视觉断言 helper。
3. 改造 Web 和 Mobile/PWA E2E 用例。
4. 改造 Electron Desktop E2E 用例。
5. 在 CI 或本地命令说明中明确运行顺序。

## 风险

- 截图不能包含密钥、完整环境变量或未授权本地路径。
- 视觉断言要稳定，避免依赖随机动画或当前时间。
- 如果页面数据依赖 mock，应固定 mock 数据，避免截图漂移。
