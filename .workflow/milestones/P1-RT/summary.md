# Milestone: P1-RT — Cloud Runtime Gateway

**Completed**: 2026-05-29
**Artifacts**: 10 archived (analyze: 2, plan: 4, execute: 1, verify: 1, review: 1, roadmap: 1)

## Key Outcomes

Cloud Runtime Gateway 三 phase 全部交付并验证通过（verify+review 均 PASS）：

- **Phase 1（gateway-contract）**: Gateway 契约 + 5 张 DB 表幂等迁移 + /api/chat 按 endpoint 路由 + 统一事件语义 + session 落库。
- **Phase 2（desktop-tunnel）**: Desktop user_local tunnel 接入 gateway，device_runtime_channels 落库 + tunnel 生命周期事件闭环（tunnel_connected/tunnel_disconnected/local_runtime_offline）+ RuntimeErrorCode 集中 packages/shared。
- **Phase 3（public-cloud-pool）**: 自建 docker compose 栈（Postgres+Redis+worker 官方镜像）+ Redis LIST/BRPOP 队列 + RuntimeExecutor/FakeExecutor 流式 + worker 状态机（running→completed/cancelled/failed）落 runtime_sessions/runtime_logs + gateway public_cloud 分支接入队列+订阅事件流 + cancelRuntimeSession。

跨 phase 集成无契约冲突：EndpointKind 单一来源，RuntimeErrorCode/RuntimeGatewayEvent 集中 shared，public_cloud/user_local 分支互不干扰，DEVICE_OFFLINE（P0 兼容）/endpoint_unavailable（REDIS 未配占位）语义保留。

真实 infra 回归：Phase 3 16/16 PASS + Phase 2 13/13 PASS；apps/web + packages/shared tsc exit 0。

## Learnings

- **自建合规（D-003）**：基础设施全部自建（官方 Postgres/Redis/node 镜像），禁用 Upstash/Neon/Modal/Supabase/PlanetScale 等托管平台作为产品依赖；banned-platform 扫描纳入验证门禁。
- **向后兼容优先**：REDIS_URL 未配时 public_cloud 回退 endpoint_unavailable 占位，user_local 分支保持 P0 DEVICE_OFFLINE 语义，新增能力不破坏既有链路。
- **集成测试 FK 链**：runtime_sessions 测试需构建完整父链 user→workspaces→sessions→runtime_sessions，否则触发 FK 约束违例。
- **终态不伪装**：worker 取消/失败必须落 cancelled/failed 终态并 emit 对应错误事件，禁止伪装 completed。

## Next Milestone

Project complete（P1-RT 为 standalone runtime 里程碑，无 roadmap 后继）。剩余 M11-M15 为 `code-complete` 状态的早期 UI 里程碑（独立轨道，非 P1-RT 后继）。

## 已知后续项

- state.json artifact registry 未补登 Phase 2/3 的 execute/verify/review 条目（lifecycle bookkeeping，磁盘证据齐全且 PASS，已随 plan 目录归档）。
- 真实 RuntimeExecutor（CLI spawn / 容器执行）接入 + worker liveness/订阅超时 + runtime_logs 统一脱敏（review out-of-scope 已知项）。
