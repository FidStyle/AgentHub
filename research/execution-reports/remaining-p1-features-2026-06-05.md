# 剩余 P1 功能收口执行报告

日期：2026-06-05  
任务：`.trellis/tasks/06-05-remaining-p1-features`  
合同：`research/contracts/REMAINING-P1-FEATURES-2026-06-05.md`  
范围：IM/联系人/自建 Agent、聊天式部署发布闭环、Mini IDE / 富文档 / Artifact workbench P1 可交付部分  
排除：最终 Demo 包、3 分钟 Demo 素材、未开始的纯 P2

## 结论

剩余 P1 第 7、8、9 项已完成并通过 Web OpenCLI、Mobile/PWA OpenCLI、Desktop/Electron fallback 和自动化质量门禁。OpenCLI 当前无 AgentHub Desktop app adapter，因此 Desktop 按合同使用 Playwright Electron fallback。

## 2026-06-05 更正

本报告的 P1 deploy/action 结论只覆盖聊天式部署 action 的 allow/reject 闭环，不覆盖 runtime native tool permission 在固定样本多角色执行中的“允许后继续原始 plan/mailbox/runtime 链路”。用户后续发现“点击允许单次执行后没有继续往下运行”，已登记为 `REG-20260605-003` 并由 `.trellis/tasks/06-05-fix-single-prompt-permission-continuation` 单独修复。P1 结论不得替代该回归的验收证据。

## 实现摘要

- `/api/chat` 增加聊天式部署意图识别，部署请求进入 `actions` 审批链路，拒绝不执行，允许后才生成 durable 部署结果。
- `dispatchApprovedAction` 支持 `deploy` action：在 workspace 内写入 `.agenthub/deployments/<actionId>/manifest.json`，创建 deployment artifact、result card message 和完成通知。
- Mobile/PWA durable action readback 增加 deployment `previewPath`、`manifestPath`、`artifactId` 摘要。
- Artifact 面板支持 deployment artifact 类型标签与图标读回。
- 修复 Web deep-link workspace 状态同步：URL workspace 现在覆盖 Zustand store，并清空旧 session/message，避免跨 workspace 显示旧会话。
- 补充回归测试：聊天部署审批、批准后部署 manifest/artifact/message、mailbox fixture、workspace deep-link store 同步相关路径。

## Web OpenCLI UAT

使用浏览器当前登录用户工作区：

- Workspace：`58a63e3f-5ca7-457b-af02-2824d02ab9fa`
- Session：`bbea8366-1e19-4ccc-9eb7-2a5d2fde6dbe`
- Workspace root：`/Users/joytion/.agenthub/cloud-workspaces/joytion/bytedance-fixed-uat-1507-58a63e3f`

通过项：

- 自建 Agent 创建并编辑读回：
  - Agent：`P1验收Agent-已编辑-1780648490`
  - DB：`role_agents` 中 `runtime_type=codex`，`capabilities=["uat","deployment","artifact"]`
- 聊天式部署拒绝路径：
  - Action：`848e1389-db7c-46a6-8c7b-dc95c211e6a3`
  - `status=rejected`
  - 拒绝后 deployment artifact 数量为 `0`
- 聊天式部署允许路径：
  - Action：`06905123-81e1-4c32-bf20-4c85b488d919`
  - `status=completed`
  - Artifact：`07dacb62-0a52-4724-8271-2d043882882c`
  - Manifest：`.agenthub/deployments/06905123-81e1-4c32-bf20-4c85b488d919/manifest.json`
  - Preview：`workspace-file:58a63e3f-5ca7-457b-af02-2824d02ab9fa:public/index.html`
- Artifact workbench：
  - 创建、编辑并刷新读回富文档 `d85af1ff-7d5f-4b51-87b6-f773fc665699`
  - 标题：`P1 富文档验收-已保存-1780648490`
  - 正文包含 `P1_DOC_CONTENT_1780648490`
  - `metadata.editRequests[0].instruction` 已持久化二次编辑请求
  - 浏览器下载 DOCX 成功，MIME `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- 文件树 / Mini IDE：
  - 文件树显示 `.agenthub/deployments/.../manifest.json`、`public/index.html`、`public/app.js`、`data/*.sqlite`
  - `public/index.html` iframe 预览可见
  - `README.md` 文本预览可见

截图目录：`e2e/artifacts/opencli-uat/remaining-p1-features-2026-06-05/`

关键截图：

- `web-agent-edited-readback.png`
- `web-deploy-rejected.png`
- `web-deploy-approved-chat.png`
- `web-deployment-artifact-panel.png`
- `web-artifact-doc-edited.png`
- `web-file-tree.png`
- `web-file-preview-index.png`
- `web-file-preview-readme.png`

## Mobile/PWA UAT

OpenCLI 打开：

```text
http://localhost:3000/m/sessions/bbea8366-1e19-4ccc-9eb7-2a5d2fde6dbe?uat=p1-mobile
```

通过项：

- `mobile-session` 可见。
- 授权记录显示 deploy completed 和 deploy rejected。
- completed deploy 读回 `previewPath`、`manifestPath`、`artifactId`。
- 截图：`mobile-session-deploy-readback.png`

## Desktop/Electron Fallback

OpenCLI adapter 检查：`opencli list -f json` 未发现 AgentHub Desktop app adapter。按合同使用 Playwright Electron fallback。

通过命令：

```bash
pnpm --filter @agenthub/desktop build
pnpm --filter @agenthub/desktop test
pnpm exec playwright test -c e2e/playwright.desktop.config.ts e2e/tests/desktop/electron.spec.ts e2e/tests/desktop/desktop-main-shell.spec.ts
```

结果：

- Desktop build PASS。
- Desktop Vitest PASS：6 files / 29 tests。
- Electron fallback PASS：21 / 21。

## 数据证据

Acceptance Postgres 查询摘要：

```text
role_agents|1
deploy_actions|2
deployment_artifacts|1
document_artifacts|1
```

部署 manifest 文件真实存在：

```text
/Users/joytion/.agenthub/cloud-workspaces/joytion/bytedance-fixed-uat-1507-58a63e3f/.agenthub/deployments/06905123-81e1-4c32-bf20-4c85b488d919/manifest.json
```

Manifest 内容包含：

```text
status=completed
mode=local_static_preview
entryPath=public/index.html
fileCount=12
```

## 自动化质量门禁

通过命令：

```bash
pnpm --filter @agenthub/web test
pnpm --filter @agenthub/web type-check
pnpm --filter @agenthub/shared type-check
pnpm --filter @agenthub/web lint
pnpm --filter @agenthub/desktop build
pnpm --filter @agenthub/desktop test
pnpm exec playwright test -c e2e/playwright.desktop.config.ts e2e/tests/desktop/electron.spec.ts e2e/tests/desktop/desktop-main-shell.spec.ts
```

结果：

- Web Vitest PASS：30 files / 294 tests。
- Web type-check PASS。
- Shared type-check PASS。
- Web lint PASS（仅既有 Next lint deprecation/config warning，无 ESLint errors）。
- Desktop build/test PASS。
- Electron fallback PASS：21 / 21。

## 未纳入范围

- 最终 Demo 包：按用户要求不处理。
- 3 分钟 Demo 素材：按用户要求不处理。
- 纯 P2：完整版本历史、多人协同编辑、完整局部选区 Agent 编辑、第三方云发布/小程序/飞书发布均未启动。
