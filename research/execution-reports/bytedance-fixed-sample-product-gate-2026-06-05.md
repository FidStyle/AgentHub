# Bytedance 固定样本 Product Gate 验收报告

日期：2026-06-05

TASK-ID：BYTEDANCE-FIXED-SAMPLE-PRODUCT-GATE-2026-06-05

## 结论

固定样本 prompt：

```text
做一个加减乘除的简单网站，使用sqlite存储历史记录
```

本轮按 Bytedance 原始多 Agent 产品链路验收通过。通过项不是单纯生成 calculator，而是同一真实 AgentHub session 完成：架构师/Orchestrator 规划、后端工程师执行、前端工程师执行、最终架构师汇总、权限审批与拒绝、文件树、Git/变更、Mobile/PWA 监督读回，以及 Desktop/Electron fallback。

## 核心对象

| 项 | 值 |
| --- | --- |
| Workspace | `58a63e3f-5ca7-457b-af02-2824d02ab9fa` |
| Workspace root | `/Users/joytion/.agenthub/cloud-workspaces/joytion/bytedance-fixed-uat-1507-58a63e3f` |
| Session | `bbea8366-1e19-4ccc-9eb7-2a5d2fde6dbe` |
| Plan | `15ce3bf0-dc53-4537-a521-210bbc6aee07` |
| Final architect runtime | `dc0a2bb2-f77c-41a5-bfdb-aa0e99fd5e89` |
| OpenCLI artifact dir | `e2e/artifacts/opencli-uat/bytedance-fixed-sample-product-gate-2026-06-05/` |

## DB 证据

| 表 | 记录数 |
| --- | ---: |
| `plans` | 1 |
| `plan_nodes` | 4 |
| `agent_mailbox_items` | 6 |
| `plan_node_attempts` | 6 |
| `runtime_sessions` | 14 |
| `messages` | 1 |
| `actions` | 10 |

Plan nodes 全部 completed：

| 节点 | 角色 | Runtime | 状态 |
| --- | --- | --- | --- |
| 架构师规划 | 架构师 | Claude Code | completed |
| 后端工程师执行 | 后端工程师 | Codex | completed |
| 前端工程师执行 | 前端工程师 | Claude Code | completed |
| 架构师汇总 | 架构师 | Claude Code | completed |

Actions：9 completed，1 rejected。Rejected action 是通过真实 `/api/actions/:id/approve` 走 `approved:false` 分支产生的 `Glob (read_file)`，用于覆盖拒绝审批读回；completed actions 覆盖 read/shell/network/destructive cleanup。

## 生成产物验收

生成网站文件：

- `package.json`
- `src/server.js`
- `public/index.html`
- `public/styles.css`
- `public/app.js`
- `test/api.test.js`
- `data/calculator.sqlite`
- `README.md`

实现采用 Node 24 内置 `node:http` + `node:sqlite`，未使用外部依赖。虽然架构师规划初始建议 Express + better-sqlite3，但固定样本要求是“简单网站 + SQLite 历史记录”，最终实现满足需求且更轻量。

API / SQLite 验证：

| 验证项 | 结果 |
| --- | --- |
| `7 + 5` | `12`，写入 SQLite |
| `7 - 5` | `2`，写入 SQLite |
| `7 * 5` | `35`，写入 SQLite |
| `10 / 2` | `5`，写入 SQLite |
| `1 / 0` | HTTP 400 `division by zero is not allowed` |
| 非法操作符 `%` | HTTP 400 |
| 非法输入 `"abc"` | HTTP 400 |
| `GET /api/history?limit=20` | 返回 4 条历史，倒序 |
| `sqlite3 data/e2e.sqlite` | `4|+-*/` |
| `node --test` | 2/2 pass |

OpenCLI Web UI 验证：

- `web-calculator-home.png`
- `web-calculator-after-ui-calc.png`，页面显示 `9 * 4 = 36` 并写入历史。

## 三端验收

| 端 | 方式 | 结果 |
| --- | --- | --- |
| Web | OpenCLI browser | PASS：真实 workspace session；固定 prompt；计划 4/4 completed；权限记录、文件树、Git/变更可见 |
| Mobile/PWA | OpenCLI browser `/m/sessions/:sessionId` | PASS：计划监督显示 4/4 节点完成，授权记录 10 条，包含 rejected/completed 状态和 workspace/cwd/tool 详情 |
| Desktop/Electron | OpenCLI 无 AgentHub app adapter，按 skill 使用 Playwright Electron fallback | PASS：`npx playwright test --config e2e/playwright.desktop.config.ts e2e/tests/desktop/electron.spec.ts e2e/tests/desktop/desktop-main-shell.spec.ts`，21/21 pass |

关键截图：

- `web-agenthub-final-session.png`
- `web-agenthub-files-loaded.png`
- `web-agenthub-changes-final-clean.png`
- `mobile-agenthub-session.png`
- `web-calculator-home.png`
- `web-calculator-after-ui-calc.png`

## 代码修复点

本轮为完成 product gate 修复了两个真实阻塞：

1. Approved native tool 续接后，原 plan node 的 waiting mailbox/attempt 没有收口，导致后续同角色队列被旧 waiting 项卡住。
2. `resume/retry/requeue` 创建新 queued mailbox 前没有 supersede 同节点旧 queued/waiting 项，导致最终汇总 UI 出现 completed plan + queued attempt 的矛盾读回。

修复后：

- Runtime completed 时会关闭同 plan node 残留 queued/waiting attempt/mailbox。
- Plan-node control 的 retry/resume/requeue 会取消同节点旧 queued/waiting attempt/mailbox。
- `dispatch-ready` 会在调度前自愈终态 plan node 下残留的 queued/waiting mailbox。

## 质量门

已通过：

```bash
pnpm --filter @agenthub/web test -- __tests__/api/plan-node-controls-inventory.test.ts __tests__/runtime/executor.test.ts __tests__/orchestrator/action-dispatcher.test.ts --run
npx playwright test --config e2e/playwright.desktop.config.ts e2e/tests/desktop/electron.spec.ts e2e/tests/desktop/desktop-main-shell.spec.ts
node --test
```

其中 Web focused tests：69 passed；Desktop Electron fallback：21 passed；生成项目 `node --test`：2 passed。

## 残留风险

- OpenCLI 当前 app adapters 没有 AgentHub Electron adapter，因此 Desktop 证据使用 Playwright Electron fallback，不是 OpenCLI app-adapter。
- 当前固定样本不覆盖 P2：部署发布、PPT/富文档、版本历史、本地选区编辑均未启动，符合用户“现在还没开始的 P2 先不做”。
