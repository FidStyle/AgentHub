# 验收硬化 2：真实环境一键启动与配置执行报告

## 范围

任务：`.trellis/tasks/06-01-acceptance-env-bootstrap/`

合同：`research/contracts/ACCEPTANCE-HARDENING-2026-06-01.md`

目标是提供可复现的本地验收环境入口，覆盖 Postgres、Redis、Auth session、Web server、runtime worker 和基础 smoke。

## 新增入口

- `pnpm env:acceptance:up`：启动 Postgres、Redis，并显式创建 fixture Auth session，写入 `docker/.p0-test.env`。
- `pnpm dev:acceptance`：复用同一套 env 启动 Web server 和本地 runtime worker，默认 `RUNTIME_EXECUTOR=script`。
- `pnpm env:acceptance:smoke`：执行真实 API CRUD smoke 和 `/api/chat` runtime smoke。
- `pnpm env:acceptance:down`：停止验收相关 Docker 容器。

## 修复点

- 新增 `scripts/acceptance-env.mjs`，避免验收时在 P0 DB compose 与 runtime compose 两套 Postgres 数据卷之间切换。
- 更新 `docker/README.md`，把推荐验收路径写成 `env:acceptance:*`，并明确 `script` executor 是确定性测试 executor，不等同于真实 Claude Code / Codex CLI。
- 更新 `apps/web/scripts/verify-p0-chat-api.ts`，按当前业务语义断言 local_desktop 不可操作时返回 HTTP 409 中文只读错误；cloud 路径断言 gateway、runtime 终态和消息持久化。
- 修复 `apps/web/lib/runtime/gateway.ts` 与 `apps/web/lib/runtime/redis-client.ts` 的 Redis pub/sub 竞态：订阅建立后才 enqueue，避免快速 worker 输出丢失。

## 验证结果

- `pnpm env:acceptance:up`：PASS，Postgres/Redis ready，fixture Auth session 写入 `docker/.p0-test.env`。
- `pnpm dev:acceptance`：PASS，Web server `http://localhost:3000` 启动，runtime worker started。
- `pnpm env:acceptance:smoke`：PASS。
  - CRUD smoke：5/5 passed。
  - `/api/chat` smoke：14/14 passed。
  - cloud SSE 包含 `gateway_connected`、`public_runtime_available`、`runtime_status`、`runtime_output`、`runtime_completed`、`done`。
  - cloud 用户消息和 runtime completed 后 agent 回复均已落库。
- `pnpm --filter @agenthub/web test`：PASS，11 files / 112 tests。
- `pnpm --filter @agenthub/web type-check`：PASS。

## 结论

第二项真实环境启动与 smoke 已完成。当前环境使用确定性 `script` executor 验证 runtime worker 链路，不等价于真实 Claude Code / Codex CLI 凭证验收；真实 CLI 和三端 UAT 仍由后续 Desktop/Mobile/Final UAT 任务覆盖。
