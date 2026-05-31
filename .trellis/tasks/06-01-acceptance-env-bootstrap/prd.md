# 验收硬化 2：真实环境一键启动与配置

## Goal

提供可复现的一键本地验收环境，避免验收时靠手工拼环境或隐式 `.env`。

## Shared Contract

- `research/contracts/ACCEPTANCE-HARDENING-2026-06-01.md`

## Requirements

- 一键启动 Postgres、Redis、seed、Auth session、Web server、runtime worker。
- 一键 smoke 覆盖 DB/Auth/API/runtime 基础连通。
- `.env.local.example`、docker env、README 或脚本必须一致。
- 默认环境不得指向不可用占位符后仍宣称产品可用。
- worker 使用真实 executor 或明确测试 executor；两者不得混淆。

## Acceptance Criteria

- [x] 干净环境可按文档/脚本启动。
- [x] smoke 命令 exit 0。
- [x] 缺配置时用户看到明确中文错误，不是假成功。
- [x] 验收报告记录命令和输出摘要。

## Execution Notes

- 新增 `scripts/acceptance-env.mjs` 和根脚本 `env:acceptance:up/down/smoke`、`dev:acceptance`。
- `env:acceptance:up` 使用 P0 Postgres compose + runtime Redis compose，并显式 seed fixture Auth session。
- `dev:acceptance` 在同一套 env 中启动 Web server 与本地 runtime worker，默认 `RUNTIME_EXECUTOR=script`，避免把确定性测试 executor 和真实 CLI executor 混淆。
- `env:acceptance:smoke` 串行运行 CRUD smoke 与 `/api/chat` smoke，覆盖 DB/Auth/API/local_desktop 409 错误态/cloud runtime worker/消息持久化。
- 修复 runtime gateway pub/sub 竞态：`subscribeEvents` 支持订阅就绪回调，public cloud 分支订阅建立后才 enqueue，避免快速 executor 丢失 `runtime_output` 导致 completed 但 agent 回复未落库。

## Verification

- `pnpm env:acceptance:up`：passed，Postgres/Redis ready，fixture Auth session written to `docker/.p0-test.env`。
- `pnpm dev:acceptance`：Web server started on `http://localhost:3000`，runtime worker started。
- `pnpm env:acceptance:smoke`：PASS，CRUD smoke 5/5；chat smoke 14/14。
- `pnpm --filter @agenthub/web test`：11 files / 112 tests passed。
- `pnpm --filter @agenthub/web type-check`：passed。

## Report

- `research/execution-reports/acceptance-env-bootstrap-2026-06-01.md`

## Likely Starting Evidence

- `package.json`
- `docker/.p0-test.env`
- `docker/docker-compose.p0-test.yml`
- `docker/docker-compose.runtime.yml`
- `apps/web/scripts/setup-p0-test-db.ts`
- `apps/web/scripts/verify-p0-api-crud.ts`
- `e2e/global-setup.ts`
