# 统一全功能主链路回归测试报告

日期：2026-06-05  
TASK-ID：UNIFIED-PRODUCT-LINE-REGRESSION-2026-06-05  
Trellis：`.trellis/tasks/06-05-unified-product-line-regression`

## 2026-06-05 纠正结论：旧 pass 已撤销

用户复核后确认：本报告原先的 `A-D pass` 结论是验收假阳性，不再作为“单句 prompt 到最终产物交付”的通过证据引用。

撤销原因：

- 原统一脚本主要读取固定历史 session、workspace 文件、artifact 行、截图路径和生成站点行为；它没有证明当前一次单句 prompt 触发真实 Orchestrator/架构师首响、前端/后端分配、逐步开发、文件编辑请求、测试和最终验收。
- 权限验证只看 action row、side effect 和截图路径，不足以证明手动“允许本次操作”后原权限卡从 pending 变为已允许/执行中/已完成，也不足以证明完全控制模式下没有出现手动权限请求。
- Artifact/产物验证只看 artifact row、manifest 和文件读回，不足以证明模型先推荐产物并等待用户确认，或用户明确指定产物；不能把全部文件默认标记为最终产物。

纠正后状态：

| 线 | 名称 | 当前状态 | 纠正说明 |
| --- | --- | --- | --- |
| A | Full-Auto Product Delivery | failed | 缺 fresh single-prompt run id、消息级开发过程、代码/文件引用和当前可见编排证据。 |
| B | Permission Lifecycle | failed | 缺原权限卡状态迁移的 durable readback；full-control/manual UX 语义未被旧脚本验证。 |
| C | Workbench / Deploy / Artifact | failed | 缺产物推荐 + 用户确认/指定语义；artifact row/manifest 不能代表最终产物确认。 |
| D | Tri-Surface State | partial | Web/Mobile/Desktop fallback 有历史读回证据，但不能单独证明 A-C 主链路真实通过。 |

新的验证脚本已改为按上述口径失败，直到存在 fresh run、消息级开发过程、权限卡状态迁移和产物确认语义为止。

纠正后脚本执行结果：

```bash
pnpm --filter @agenthub/web exec tsx scripts/verify-unified-product-lines.ts
```

结果：预期失败，exit 1。

| 线 | 状态 | 失败摘要 |
| --- | --- | --- |
| A | failed | 缺 `UNIFIED_REGRESSION_RUN_ID` fresh run marker；消息流未证明前端 + 后端/storage 分配。 |
| B | failed | full-control 样本仍存在 pending manual permission card。 |
| C | failed | deployment artifact 缺模型推荐 + 用户确认 metadata；消息流缺产物推荐/确认步骤。 |
| D | pass | 仅证明历史 Web/Mobile/Desktop fallback 读回存在，不足以让整体回归通过。 |

Break-loop 根因：

| 维度 | 结论 |
| --- | --- |
| Root Cause Category | D Test Coverage Gap + B Cross-Layer Contract + E Implicit Assumption |
| Specific Cause | 验证器把历史终态 DB/文件/截图坐标等同于当前真实用户流，把“生成物可运行”等同于“AgentHub 一句话完整交付”。 |
| Why Fix Failed | 旧检查停在 DB 行、截图文件和生成项目 API；没有消息流语义、权限卡原状态迁移、full-control 行为和产物确认协议。 |
| Prevention | `.trellis/spec/cross-layer/real-flow-acceptance.md`、`.trellis/spec/guides/end-to-end-contract-planning.md` 和 `apps/web/scripts/verify-unified-product-lines.ts` 已加入防静态坐标假阳性规则。 |

## 测试线

| 线 | 名称 | 状态 | 证据 |
| --- | --- | --- | --- |
| A | Full-Auto Product Delivery | failed | 旧证据不足：fixed sample DB/session/workspace 与生成站点 API/UI/SQLite 不能证明 fresh single-prompt 开发过程 |
| B | Permission Lifecycle | failed | 旧证据不足：action/side effect/截图不能证明权限卡状态迁移与 full-control 无手动卡 |
| C | Workbench / Deploy / Artifact | failed | 旧证据不足：artifact row/manifest 不能证明模型推荐 + 用户确认产物 |
| D | Tri-Surface State | partial | 历史 Web/Mobile/Desktop fallback 读回存在，但不能独立支撑整体 pass |

## 原则

- 历史报告只作参考，本报告必须记录本轮重新执行的证据。
- 能归并到同一 workspace/session 的功能尽量归并。
- 任一线路失败时先修复，再回归该线路。
- 状态只能写 `pass` / `partial` / `failed` / `blocked` / `not-run`。

## 执行记录

### 统一验证脚本

新增并执行：

```bash
pnpm --filter @agenthub/web exec tsx scripts/verify-unified-product-lines.ts
```

原结果曾记录为 A-D 四条线全部 `pass`。该结论已撤销：脚本虽然重新读取 acceptance Postgres、workspace 文件系统、生成 calculator 服务、SQLite 文件、OpenCLI 证据目录和 Desktop fallback 证据，但缺少 fresh single-prompt run、消息级开发过程、权限卡状态迁移和产物确认语义。

核心对象：

| 项 | 值 |
| --- | --- |
| Fixed workspace | `58a63e3f-5ca7-457b-af02-2824d02ab9fa` |
| Fixed session | `bbea8366-1e19-4ccc-9eb7-2a5d2fde6dbe` |
| Fixed plan | `15ce3bf0-dc53-4537-a521-210bbc6aee07` |
| Workspace root | `/Users/joytion/.agenthub/cloud-workspaces/joytion/bytedance-fixed-uat-1507-58a63e3f` |
| P1 deploy completed action | `06905123-81e1-4c32-bf20-4c85b488d919` |
| P1 deploy rejected action | `848e1389-db7c-46a6-8c7b-dc95c211e6a3` |
| P1 deployment artifact | `07dacb62-0a52-4724-8271-2d043882882c` |
| P1 document artifact | `d85af1ff-7d5f-4b51-87b6-f773fc665699` |

### A. Full-Auto Product Delivery

通过项：

- plan `completed`，4 个节点全部 `completed`。
- 后端工程师节点绑定 Codex 并完成；前端工程师节点绑定 Claude Code 并完成。
- completed plan 下无 `queued` / `waiting` attempts 或 mailbox 残留。
- fixed session 下 permission actions 无 pending；存在 completed actions。
- workspace 文件存在：`package.json`、`src/server.js`、`public/index.html`、`public/styles.css`、`public/app.js`、`test/api.test.js`、`data/calculator.sqlite`、`README.md`。
- 生成项目 `node --test` PASS。
- 验证器启动生成站点真实 HTTP 服务，API 覆盖 `+ - * /`、除零、非法操作符、非法输入。
- SQLite 文件读回：`4|+-*/`。
- OpenCLI Web 证据存在：`web-agenthub-final-session.png`、`web-agenthub-files-loaded.png`、`web-agenthub-changes-final-clean.png`、`web-calculator-after-ui-calc.png`。

### B. Permission Lifecycle

通过项：

- full-auto 线路 actions 已 completed 且无 pending。
- manual allow action `60f886f1-2684-49c8-9085-4ad465c4568b` 已 dispatch continuation，`executed_at` 存在。
- allow 副作用真实写入 workspace：`agenthub-permission-status-sync.txt`。
- reject action `3312a56a-082c-4e45-b9fc-fe1ae1adb04c` 为 `rejected` 且 `executed_at` 为空。
- reject 对应 plan node 保持 `waiting`，并写入 durable user-visible event。
- OpenCLI 证据：`permission-continuation-web-reject-2026-06-05.png`、`permission-continuation-mobile-reject-2026-06-05.png`。

### C. Workbench / Deploy / Artifact

通过项：

- 自建 Agent `ec25dcf7-ff39-4515-aba0-34cbfa5f341d` 已编辑读回，`runtime_type=codex`。
- deploy reject action durable rejected，未执行。
- deploy allow action durable completed，manifest 文件存在。
- deployment artifact metadata `kind=deployment`，manifest 指向 `public/index.html`。
- 富文档 artifact 已创建、编辑、记录二次编辑请求，内容包含 `P1_DOC_CONTENT`。
- OpenCLI 证据覆盖 agent、deploy reject/allow、deployment artifact panel、document edited、file tree、index/README preview、Mobile deploy readback。

### D. Tri-Surface State

通过项：

- Web OpenCLI 新截图：`e2e/artifacts/opencli-uat/unified-product-line-regression-2026-06-05/web-fixed-session.png`。
- Mobile/PWA OpenCLI 新截图：`e2e/artifacts/opencli-uat/unified-product-line-regression-2026-06-05/mobile-fixed-session.png`。
- Web/Mobile 读取同一 completed plan 和同一授权记录。
- 当前 OpenCLI 无 AgentHub Desktop app adapter；按项目合同使用 Playwright Electron fallback。
- Desktop build/test/fallback PASS：Electron fallback 21/21。

### 质量门禁

已通过：

```bash
pnpm --filter @agenthub/web type-check
pnpm --filter @agenthub/shared type-check
pnpm env:acceptance:smoke
pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/orchestrator/action-dispatcher.test.ts __tests__/api/plans-actions-owner.test.ts __tests__/runtime/executor.test.ts __tests__/api/artifacts.test.ts --run
pnpm --filter @agenthub/web lint
pnpm --filter @agenthub/desktop build
pnpm --filter @agenthub/desktop test
pnpm exec playwright test -c e2e/playwright.desktop.config.ts e2e/tests/desktop/electron.spec.ts e2e/tests/desktop/desktop-main-shell.spec.ts
```

结果：

- Web type-check PASS。
- Shared type-check PASS。
- Acceptance smoke PASS：CRUD 5/5，`/api/chat` 11/11。
- Focused Web regression suite PASS：5 files / 94 tests。
- Web lint PASS（仅既有 Next lint deprecation/config warning，无 ESLint errors）。
- Desktop build PASS。
- Desktop Vitest PASS：6 files / 29 tests。
- Electron fallback PASS：21 / 21。

### 残留风险

- OpenCLI 当前没有 AgentHub Electron app adapter；Desktop 仍按合同使用 Playwright Electron fallback。
- Demo 包和 3 分钟素材按用户要求不处理。
- 未开始的纯 P2 未纳入本轮。
