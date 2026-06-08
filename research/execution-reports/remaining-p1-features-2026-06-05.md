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

## 2026-06-08 Agent 工具模型收口

本轮按 `.trellis/spec/cross-layer/bytedance-im-agent-artifact-goal.md` 的 P1 Phase 1 决策，把 Role Agent 的展示标签、Runtime 绑定和可请求工具从旧 `capabilities/toolset_ids` 模型中拆开：

- `capability_tags` 只作为显示标签，UI 统一渲染为 `#标签`。
- `enabled_tool_ids` 改为具体内置工具：`file_read`、`file_write`、`shell`、`git_cli`、`web_search`、`web_fetch`、`browser_preview`、`diff_apply`、`artifact_store`、`publish_service`、`ppt_master`。
- 新增 `GET /api/tools/catalog`，Role Agent 编辑器从该目录读工具清单并保存具体工具 ID。
- API 对旧 `capabilities` / `toolset_ids` 输入 fail closed，提示迁移到 `capability_tags` / `enabled_tool_ids`；Runtime ID（如 `codex`）作为工具会被拒绝。
- Acceptance schema 增加旧列到新列的幂等迁移，避免旧验收库升级时丢失自建 Agent 标签和工具配置。
- `dispatchApprovedAction` 按具体工具 ID 校验 role-scoped action，权限审批仍由 action broker 决定，启用工具不等于自动执行。

Fresh UAT 复核：

- 首次 full-control 复核 `REAL-TOOLS-UAT-1780891400-FULL` 失败，失败点是固定 prompt 未生成 `public/index.html` 的最终产物候选 artifact row，也未在中央 IM 产生产物推荐/确认 result card。
- 修复后使用同一 canonical prompt 重新跑 fresh full-control gate：`REAL-TOOLS-UAT-1780892500-FULL` PASS（74 passed / 0 failed / 0 warned）。
- Fresh workspace：`d3cbf9e1-b2ce-48e9-ac40-6a96b3ec4bc6`。
- Fresh session：`41ab5f3b-31fd-4c53-a1d1-4b4561b1db58`。
- Plan：`04bbfa1b-e408-4097-a3da-260e7e7e3bf8`。
- Final artifact：`68bc13e6-9184-4ec3-be78-9c421a9904f3`。
- Evidence：`e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-TOOLS-UAT-1780892500-FULL/`。
- Fresh manual permission gate：`REAL-TOOLS-PERMISSION-UAT-1780892500` PASS（38 passed / 0 failed / 0 warned）。
- Allow branch：workspace `f39e9b4f-1a9f-4118-bcfa-26ab8d34dbf1`，session `b44807dd-b465-4f2c-9a8f-50406e581b29`，action `20a8620d-230f-4825-9740-ff552df4a4f2`，side-effect file written.
- Reject branch：workspace `4b8a9d0f-93c1-4c86-af59-ec1b1209c037`，session `3512765a-7adc-4f87-afeb-a6c802c0aabb`，action `4365a754-6857-4816-9de9-4cd23e70f622`，side-effect file absent and plan node remains waiting.
- Permission evidence：`e2e/artifacts/opencli-uat/fresh-permission-branches-2026-06-07/REAL-TOOLS-PERMISSION-UAT-1780892500/`。

本轮自动化验证：

```bash
pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts
pnpm --filter @agenthub/shared build
pnpm --filter @agenthub/web test
pnpm --filter @agenthub/shared test
pnpm --filter @agenthub/web type-check
pnpm --filter @agenthub/shared type-check
pnpm --filter @agenthub/web lint
git diff --check
```

结果：

- Focused Web chat regression PASS：17 tests，覆盖 canonical prompt 在 full-control 下生成最终产物 artifact 和产物推荐/确认 result card。
- Shared build PASS，并更新 tracked `packages/shared/dist/index.js` / `index.d.ts`。
- Web Vitest PASS：33 files / 339 tests。
- Shared Vitest PASS：7 files / 54 tests。
- Web type-check PASS。
- Shared type-check PASS。
- Web lint PASS（仅既有 Next lint deprecation/config warning，0 ESLint errors）。
- `git diff --check` PASS。

治理门禁状态：

- `bash scripts/verify-governance-gate.sh REMAINING-P1-FEATURES-2026-06-05` 当前未通过，原因是本轮代码和报告尚未提交，脚本要求 clean worktree 且最近 commit 覆盖 report/tracker。提交后需要重跑。

## 未纳入范围

- 最终 Demo 包：按用户要求不处理。
- 3 分钟 Demo 素材：按用户要求不处理。
- 纯 P2：完整版本历史、多人协同编辑、完整局部选区 Agent 编辑、第三方云发布/小程序/飞书发布均未启动。
