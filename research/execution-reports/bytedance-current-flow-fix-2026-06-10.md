# BYTEDANCE-P0-P1-REAL-STEP-UAT 当前主流程修复验收报告

## 范围

- 修复 full-control 自动通过卡被误判为等待授权的问题。
- 修复真实 Runtime 静默编辑时过早 idle timeout 的问题。
- 调整 Web 聊天空态、会话列表密度和 UAT 鉴权读回。
- 验证 IM 内联 `Git diff`、产物、iframe/web preview、发布状态卡、标准权限交互和三端读回。

## Fresh UAT 结果

### Full-control 产品交付主链路

- 命令：`pnpm --filter @agenthub/web exec tsx scripts/verify-strict-single-prompt-product-delivery.ts`
- Marker：`BYTEDANCE-CURRENT-FINAL-1781025161`
- 状态：`PASS`
- 断言：`78 passed / 0 failed`
- Workspace：`0b827668-5d74-49a4-bc3b-2d56263cfc92`
- Session：`61912ccb-78a7-4b26-b7d7-d4cd194f06a6`
- Plan：`fa73a80d-7c7d-4ab6-befe-930564ec1e47`
- Artifact：`45a0a70e-1f46-4b6c-88d1-1592501c1e9d`
- 证据目录：`e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/BYTEDANCE-CURRENT-FINAL-1781025161`

覆盖项：

- 四节点计划全部 completed。
- 后端、前端、架构师汇总均由真实 runtime session 完成。
- IM result card 内联包含 `change_summary`、`diff`、`artifact`、`web_preview`、`publish_status`。
- 生成项目包含 `package.json`、`src/server.js`、`public/index.html`、`public/app.js`、`public/styles.css`、`README.md`。
- 生成网站 API、浏览器 HTTP、SQLite 历史持久化、文件树、文件预览、最终 artifact row、Web/Mobile/Desktop readback 全部通过。

### 标准/非完全权限分支

- 命令：`pnpm --filter @agenthub/web exec tsx scripts/verify-fresh-permission-branches.ts`
- Marker：`BYTEDANCE-PERMISSION-FINAL-1781025780`
- 状态：`PASS`
- 断言：`38 passed / 0 failed`
- 证据目录：`e2e/artifacts/opencli-uat/fresh-permission-branches-2026-06-07/BYTEDANCE-PERMISSION-FINAL-1781025780`

覆盖项：

- Allow 分支：pending 授权卡出现，用户允许后 dispatch continuation，产生 workspace 内 side effect，Web/Mobile 均读回状态。
- Reject 分支：pending 授权卡出现，用户拒绝后不产生 side effect，plan node 保持 waiting，Web/Mobile 均读回拒绝状态。

## 质量门禁

- `pnpm --filter @agenthub/web type-check`：通过。
- `pnpm --filter @agenthub/web lint`：通过。
- `pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/runtime/executor.test.ts __tests__/runtime/liveness.test.ts __tests__/message-markdown.test.ts __tests__/chat-im-polish.test.ts __tests__/session-store.test.ts`：通过，`127 passed`。
- `git diff --check`：通过。

## 结论

当前 fresh run 下，用户重点要求的 AI 对话过程卡片、full-control 自动审计、标准权限交互、用户允许后继续执行、服务型产物启动命令、发布/停止入口基础链路、Web/Mobile/Desktop 读回均通过验收脚本。
