# Remove message markdown actions wrapper and add opencli E2E coverage

## Goal

收敛 Web 消息 Markdown 渲染的 DOM 结构，去掉多余的 `message-markdown-actions` 包裹层，只保留现有 `flex shrink-0 items-center gap-1` 容器，并补齐真实浏览器 E2E 验证，避免“只改样式、没跑真实验收”的假绿。

## What I already know

* `apps/web/components/workspace/MessageMarkdown.tsx` 里当前确实存在 `<div className="message-markdown-actions">` 包裹 `CopyButton`。
* 对应样式写在 `apps/web/app/globals.css`，测试断言也在 `apps/web/__tests__/message-markdown.test.ts`。
* `MessageMarkdown` 只在 Web 侧 `MessageContent` 中使用，没有在 `apps/mobile` 直接复用。
* 项目前端规范要求 UI 任务必须有真实浏览器验收，优先用 OpenCLI 记录证据。
* 相关质量门禁要求：不能只靠组件快照或 `toBeVisible` 声称主链路通过。

## Assumptions

* 这是一个 Web-only 组件清理，不引入新的产品交互。
* 真实 E2E 以 OpenCLI 浏览器验收为主；如果后续同一 Markdown 渲染路径被 Desktop/Electron 复用，再补对应回归，但本任务不主动扩展范围。

## Requirements

* 删除 `MessageMarkdown` 里的 `message-markdown-actions` 包裹层。
* 保留现有 copy 按钮的布局和 hover/focus 行为，只使用 `flex shrink-0 items-center gap-1` 这层容器。
* 清理与该 wrapper 绑定的过时 CSS 或测试断言。
* 保持 Markdown 渲染、复制整条消息、代码块复制、列表/表格/链接等现有行为不回退。
* 增加或更新真实浏览器 E2E，使用 OpenCLI 验证 Web 端真实页面上的 Markdown 渲染和复制入口可用。

## Acceptance Criteria

* [ ] `MessageMarkdown` 中不再出现 `message-markdown-actions` wrapper。
* [ ] 页面结构仍有稳定的 `flex shrink-0 items-center gap-1` 容器，copy 按钮布局不乱。
* [ ] `message-markdown.test.ts` 的断言与实现一致，不再依赖旧 wrapper 类名。
* [ ] 真实浏览器 E2E 通过 OpenCLI 跑通 Web 端消息 Markdown 场景，并留下可复核证据。
* [ ] 相关 lint / type-check / test 通过。

## Definition of Done

* UI 改动遵守 `.trellis/spec/frontend/index.md`、`component-guidelines.md`、`quality-guidelines.md`。
* 真实浏览器验收遵守 `.trellis/spec/cross-layer/real-flow-acceptance.md` 和 `agenthub-opencli-uat` 约定。
* 不把组件测试当成真实 UAT。
* 不扩写成新的产品功能线。

## Out of Scope

* 不改消息 Markdown 的语义逻辑。
* 不引入新的按钮或额外消息操作。
* 不扩展成完整的 Desktop/Electron 产品改造。

## Technical Notes

* 目标文件：
  * `apps/web/components/workspace/MessageMarkdown.tsx`
  * `apps/web/app/globals.css`
  * `apps/web/__tests__/message-markdown.test.ts`
* 使用的验收约束：
  * `research/contracts/ORCHESTRATOR-IM-MARKDOWN-GIT-DIFF-2026-06-03.md`
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/frontend/component-guidelines.md`
  * `.trellis/spec/frontend/quality-guidelines.md`
  * `.trellis/spec/cross-layer/real-flow-acceptance.md`
* opencli 约定：优先真实 Web 浏览器入口，输出截图和行为证据。
