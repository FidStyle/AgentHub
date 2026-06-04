# Fix Message Action Duplicate Topbar

## 背景

当前消息区存在两层操作入口：外层消息顶栏 `class="mb-1 flex items-start justify-between gap-2"`，以及 `MessageMarkdown` 内部重复渲染的 `class="flex shrink-0 items-center gap-1"` 操作层。重复按钮会让同一条消息出现两组复制/操作控件，破坏 `FR-CHAT-001` 的 IM 消息体验和 `FR-UI-001` 的一致组件契约。

## 绑定来源

- 产品端面：Web 消息工作台；Mobile/PWA 仅在复用同一消息组件时受影响；Electron/Desktop 若不复用该 Web 组件则不适用。
- 绑定需求：`FR-CHAT-001`, `FR-WEB-001`, `FR-MOB-001`, `FR-UI-001`。
- 设计/规范来源：`research/product/product-design.md`, `research/product/ui-design-system.md`, `.trellis/spec/frontend/component-guidelines.md`, `.trellis/spec/frontend/ui-style-guidelines.md`, `.trellis/spec/frontend/quality-guidelines.md`, `.trellis/spec/cross-layer/parallel-worktree-testing.md`, `.trellis/spec/cross-layer/real-flow-acceptance.md`。

## 范围

1. 删除 `MessageMarkdown` 内部重复的 `class="flex shrink-0 items-center gap-1"` 操作层。
2. 保留外层消息顶栏 `class="mb-1 flex items-start justify-between gap-2"` 的操作入口。
3. 确认 Web 消息页面真实渲染时每条消息只出现一组操作入口。
4. 保存 opencli UAT 证据到 `e2e/artifacts/opencli-uat/message-actions-topbar/`。

## 验收标准

- Web：必须通过 `opencli doctor` 与 `opencli browser agenthub ...` 打开真实页面，保存截图、DOM/状态证据和命令记录。
- Mobile/PWA：如果同一消息组件在移动视口复用，必须 inspect 或验收；如果未能进入页面或不共享该 UI，报告中标明范围和原因。
- Electron/Desktop：如果未复用该 Web 消息组件，报告标记 `not-applicable`，并说明原因。
- 回归：运行相关 unit/type/lint；OpenCLI 证据不得用 Playwright E2E 代替。
- 证据路径：`e2e/artifacts/opencli-uat/message-actions-topbar/`。
