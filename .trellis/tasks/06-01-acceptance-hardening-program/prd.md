# 验收前全功能硬化总控

## Goal

在最终验收前，把 AgentHub 从“局部 MVP/技术链路可跑”硬化到“真实用户核心链路可验收”。不再接受 mock 主链路、FakeExecutor echo、测试 skip、echo build/type-check 或局部绿灯作为完成。

## Shared Contract

- `research/contracts/ACCEPTANCE-HARDENING-2026-06-01.md`

## What I already know

- 当前工作区干净。
- 之前检查发现：`pnpm lint` 红在 Desktop `local-adapter.ts`；Web Vitest 失败；根 `pnpm test` 未纳入 Web；Mobile `type-check`/`build` 是 echo skip；runtime worker 默认 `FakeExecutor`。
- Web build 与 Web/Desktop/shared type-check 当前基本可用，但不能代表整体验收。
- E2E 已有 151 条收集结果，但核心链路存在 env skip/deferred 与 `ScriptedRealExecutor` 测试替身。

## Work Packages

1. `06-01-acceptance-quality-gates`：质量门禁与测试覆盖修复。
2. `06-01-acceptance-env-bootstrap`：真实环境一键启动与配置。
3. `06-01-acceptance-web-core-flow`：Web 主链路真实回归。
4. `06-01-acceptance-desktop-runtime`：Desktop 本地能力验收。
5. `06-01-acceptance-mobile-surfaces`：Mobile PWA 与 RN 真实闭环。
6. `06-01-acceptance-final-uat-governance`：最终 UAT 与治理证据。

## Requirements

- 所有核心功能必须走真实 DB/API/session/runtime 语义。
- 所有门禁失败都必须当阻塞处理。
- 所有核心 E2E 不得默认 skip 后宣称通过。
- 每个阶段必须补测试证据和 tracker/ledger/report。

## Acceptance Criteria

- [ ] 合同完成并登记到 `research/index.md`、`research/project-tracker.md`。
- [ ] 六个子任务按顺序完成。
- [ ] 所有完成门禁满足合同第 11 节。
- [ ] Codex 最终验收明确列出命令、结果、截图/报告、残留风险。

## Out of Scope

- 新增非验收所需产品功能。
- 复制参考项目代码。
- 使用 mock 主链路数据绕过真实验收。

## Technical Notes

- 优先修复已知硬红，再扩展验收面。
- 任务执行顺序固定：质量门禁 → 环境 → Web → Desktop → Mobile → Final UAT。
