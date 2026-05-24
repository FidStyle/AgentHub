# 实现说明：Mobile PWA 轻量 IM、审批与预览界面

## 重点文件候选

- `apps/web/app/**`
- `apps/web/components/**`
- `apps/web/components/chat/**`
- `e2e/playwright.config.ts`
- `e2e/tests/**`

## 开发顺序

1. 先扩展 Playwright mobile project 或移动视口用例。
2. 实现移动 Workspace/Session 列表布局。
3. 实现移动会话和输入框。
4. 实现审批详情和预览页。
5. 补截图、无横向滚动、导航无遮挡断言。

## 风险

- 不要新增独立移动技术栈。
- 不要把 Web 三栏压缩到手机屏幕。
- 大输出、Diff 和长文件名必须默认折叠或摘要化。
