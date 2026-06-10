# 修复 runtime progress timeout 与标准权限连续批准

## Goal

修复 AgentHub 真实 runtime 长任务被订阅层 progress timeout 误判取消的问题，并回归标准权限模式下连续批准工具请求后能继续执行直到正常完成。

## What I already know

* 用户实测 `生成一个关于字节跳动的文档和ppt` 时，DAG 为 `架构师规划 -> 演示稿工程师执行 -> 产物助手收口 -> 架构师汇总`。
* DB 证据：plan `154d3dbb-86ad-45da-b37f-f37d99c8ce95` failed；演示稿 runtime `a3af7b3c-7e9b-4949-ac2a-00f4d611e44e` / native `019eb2bc-ca05-7693-bc6c-da2e891e4c27` 被写成 `cancelled by request`。
* runtime logs 显示只有 1 条 `runtime_output`，后续主要是 tool observed actions 和 heartbeat；订阅层 progress timeout 后写入 cancel key，worker 随后落 `runtime_cancelled`。
* workspace 实际已经生成 `字节跳动研究文档.md`、`字节跳动主题演示稿.pptx`、`字节跳动演示稿预览.html`，但 artifacts 表 0 行，说明 AgentHub 状态机先失败，产物助手未收口。
* 当前代码把 `cancelled` 视为失败依赖，下游 `产物助手收口` 和 `架构师汇总` 被阻断。
* 用户要求同时检查标准模式：如果用户持续同意权限卡，应能继续执行并正常通过。

## Requirements

* 长任务不能仅因为订阅端一段时间只收到 heartbeat 而被写成 `cancelled by request`。
* 订阅超时可以让当前 HTTP/SSE 流结束并提示 runtime 仍在后台运行，但不得伪造用户取消，不得把 runtime/attempt/mailbox/plan node 改为 cancelled/failed。
* 工具 observed action、权限请求、等待边界、业务输出都应被视为 runtime 有进展；heartbeat 只表示存活，不代表业务进展。
* 标准权限模式下，非 full-control 工具请求必须生成可见权限卡；用户批准后续跑；如果续跑遇到第二个权限请求，应继续生成下一张权限卡，允许用户连续批准直到任务完成。
* PPT/文档生成场景中，演示稿工程师完成后必须允许产物助手收口，把生成文件登记为 durable artifacts 并生成结果/预览卡。
* 不改变 destructive permission 的安全边界，不把 standard/sandbox/auto 提升为自动批准。

## Acceptance Criteria

* [x] Unit test 覆盖 heartbeat-only progress timeout：订阅端返回 `runtime_backgrounded` 后继续等待真实终态，不调用 `setCancel`，不产生 `runtime_failed: runtime progress timeout`。
* [x] Unit/API test 覆盖 observed tool action 会刷新 progress timer，长任务探测/生成阶段不会被误取消。
* [x] Worker/API test 覆盖标准权限连续批准：批准后继续执行，后续权限请求继续生成下一张卡；真实 UAT 已连续批准 3 张卡直到 plan completed。
* [x] Existing permission boundary tests still pass：标准模式等待授权不是 runtime failure；full-control 自动审计继续可用。
* [x] Focused tests pass for runtime subscription, worker executor, chat/orchestrator permission flow.

## Verification Notes

* Focused unit/API tests: `pnpm --filter @agenthub/web test -- __tests__/orchestrator/action-dispatcher.test.ts __tests__/runtime/executor.test.ts __tests__/runtime/subscribe-timeout.test.ts __tests__/api/chat.test.ts --run` → 107 passed.
* Type-check: `pnpm --filter @agenthub/web type-check` and `pnpm --filter @agenthub/shared type-check` passed.
* Lint: `pnpm --filter @agenthub/web lint` passed with existing Next lint deprecation/config warnings only.
* Real standard permission UAT: `pnpm --filter @agenthub/web exec tsx scripts/verify-fresh-permission-branches.ts` passed, run marker `PERMISSION-BRANCH-1781118273703-9c6160`, evidence dir `e2e/artifacts/opencli-uat/fresh-permission-branches-2026-06-07/PERMISSION-BRANCH-1781118273703-9c6160`.
* Allow branch approved actions: `3ddf9d09-610b-4558-ba34-6c530b23e4ad`, `a64775ca-596f-4b0c-bfcb-88323a97464b`, `b79ead4b-fc31-47a0-975f-0e6e280df721`; target file content verified and plan `bd375ba4-8a7a-43e6-b0e2-2e932a140ae1` completed.
* Reject branch action `83700052-ee5a-4a77-bb05-a20817a4e4d3` was rejected; target file did not exist after rejection.

## Definition of Done

* 修复代码路径保持小范围，优先改 runtime subscription/cancel 语义和已有测试。
* 运行相关 focused tests；如无法运行完整 suite，记录未跑范围和原因。
* 不提交 `.workflow/.maestro/*/status.json` 或无关 dirty 文件。

## Out of Scope

* 不重做整个 runtime gateway。
* 不实现新的 artifact UI。
* 不修改 presentation 内容生成模板，除非测试证明必须调整。
* 不把标准权限改成自动批准。

## Technical Notes

* Key files:
  * `apps/web/lib/runtime/redis-client.ts`
  * `apps/web/server/runtime-worker.ts`
  * `apps/web/lib/runtime/executor.ts`
  * `apps/web/lib/orchestrator/plan-progress.ts`
  * `apps/web/lib/orchestrator/dag-scheduler.ts`
  * `apps/web/__tests__/runtime/subscribe-timeout.test.ts`
  * `apps/web/__tests__/runtime/executor.test.ts`
* Relevant specs:
  * `.trellis/spec/cross-layer/runtime-gateway-permission-wait.md`
  * `.trellis/spec/cross-layer/im-conversation-artifact-contract.md`
