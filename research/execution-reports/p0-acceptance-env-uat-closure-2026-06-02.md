# P0 验收环境与 UAT 收口报告

TASK-ID: P0-ACCEPTANCE-ENV-UAT-CLOSURE

## 范围

- 统一验收环境入口：`docker/.acceptance.env` + `env:acceptance:*`。
- Web DB 变更型 E2E：新增串行 acceptance profile，删除历史兼容别名。
- 报告漂移：旧 `@架构师`、旧「上下文/Agents」Tab、message metadata 派生产物等测试口径已对齐当前真实 UI/API。
- native session resume/continue：Desktop 已接官方 CLI 续接能力；Claude Code 使用 `--resume/--continue`，Codex 使用 `codex exec resume`，AgentHub 记录并复用 native session id。

## 关键修复

- `apps/web/scripts/setup-acceptance-test-db.ts` 写入 `docker/.acceptance.env`，只接受 `ACCEPTANCE_*` 命名。
- `scripts/acceptance-env.mjs`、`apps/web/server.ts`、`e2e/global-setup.ts` 只读取 `docker/.acceptance.env`，不再 fallback。
- `docker/docker-compose.acceptance.yml`、`docker/postgres/acceptance-schema.sql` 替代旧 P0 命名文件。
- `package.json` 新增：
  - `pnpm test:e2e:acceptance`
  - `pnpm test:e2e:acceptance:runtime`
  - `pnpm test:e2e:acceptance:no-worker`
- `e2e/helpers/auth-state.ts` 改为 `ensureAcceptanceStorageState`，global setup 将 seeded env 注入 Playwright worker。
- E2E 按当前产品修正：默认角色 `Orchestrator`；右栏「角色/文件/变更/产物」；artifact 只认 durable `/api/artifacts`，不再把消息 metadata 当产物。

## 验证证据

| 命令 | 结果 |
| --- | --- |
| `pnpm env:acceptance:smoke` | PASS：CRUD 5/5，`/api/chat` 11/11，smoke 可自动临时启动 Web |
| `pnpm test:e2e:acceptance` | PASS：18 passed |
| `pnpm test:e2e:acceptance:runtime` | PASS：2 passed |
| `pnpm test:e2e:acceptance:no-worker` | PASS：1 passed |
| `pnpm --filter @agenthub/shared build` | PASS |
| `pnpm --filter @agenthub/web type-check` | PASS |
| `pnpm --filter @agenthub/desktop type-check` | PASS |
| `pnpm --filter @agenthub/web test -- __tests__/api/runtime-status.test.ts __tests__/api/chat.test.ts __tests__/runtime` | PASS：8 files / 35 tests |
| `pnpm --filter @agenthub/desktop test` | PASS：5 files / 27 tests |

## 台账状态

- `REG-20260601-002`：closed。P0 反查剩余项已通过真实 Web acceptance E2E 和 Desktop native session 官方续接口径收口。
- `REG-20260530-008`：closed。可复现验收/演示入口统一为 acceptance env；普通 `pnpm dev:web` 仍保留开发者自带 `.env.local` 模式。
- `REG-20260530-002`：closed for P0 acceptance。共享 Auth.js 用户的 DB 变更型 E2E 必须使用 serial acceptance profile；这不限制普通 CLI 并行或非共享状态测试并行。

## 残留风险

- 外部 OAuth/登录绑定点击仍需 opencli 或人工环境验证，不能计入自动 passed。
- 原生 RN 设备/模拟器 GUI 未纳入本轮自动验收。
- Desktop native session resume/continue 依赖本机 Claude Code / Codex CLI 的官方会话记录；CLI 不可用或未登录时仍会明确失败。
