# P1-RT Phase 2 执行报告 — Desktop Local Runtime Tunnel 接入 Cloud Runtime Gateway

- **任务**: P1-RT-PHASE2 / `PLN-20260529-p1-rt-phase2`（4 tasks / 2 waves）
- **会话**: ralph-20260529-194146
- **日期**: 2026-05-29
- **基线 commit**: acc8b59（Phase 1）
- **合同**: `research/contracts/P1-RUNTIME-GATEWAY.md#Phase2`、`.trellis/spec/cross-layer/runtime-gateway-contract.md`

## 范围

复用现有 `/ws/device` + `device-connections` in-memory relay 作为 tunnel 真源，把 user_local endpoint 的 tunnel/channel 状态接入 `device_runtime_channels`，打通 tunnel 生命周期事件闭环并统一 RuntimeErrorCode。不改 Desktop 主进程执行模型，不连真实部署平台（Phase 3 / D-003）。

## 改动清单

| Task | Goal | 文件 | 说明 |
|------|------|------|------|
| TASK-001 | G2 | `packages/shared/src/runtime/error-codes.ts`（新）、`index.ts` | RuntimeErrorCode 集中常量 union（DEVICE_OFFLINE/endpoint_unavailable/public_runtime_unconfigured/tunnel_disconnected）+ shared 导出 |
| TASK-002 | G1 | `apps/web/lib/runtime/device-channel-store.ts`（新）、`apps/web/server/ws-gateway.ts` | markChannelConnected/markChannelDisconnected/getChannelByDevice（select+insert/update 语义）；ws-gateway addConnection→connected、close/心跳超时→disconnected |
| TASK-003 | G1 | `apps/web/lib/runtime/gateway.ts` | invoke() user_local 分支读 channel 状态 + in-memory 连接共同判定：曾连接后断开 emit tunnel_disconnected，从未连接 emit local_runtime_offline；内联错误码字符串替换为 RuntimeErrorCode 引用 |
| TASK-004 | G3 | `apps/web/scripts/verify-p1-rt-phase2.ts`（新）、tracker、本报告 | Phase 2 集成测试 + 治理账本同步 |

## 关键设计

- **tunnel_disconnected vs local_runtime_offline 判定**：channel `connected_at != null` 表示曾建立过隧道（即便当前 status=disconnected），据此 emit `tunnel_disconnected`；无 channel 或从未连接 emit `local_runtime_offline`。两者均仍 emit `runtime_status=DEVICE_OFFLINE` 以保 P0 契约兼容。
- **落库单点驱动**：连接生命周期（addConnection/close/心跳超时）单点 upsert `device_runtime_channels`，invoke 请求期只读 channel 状态判定事件，不在一次性生成器内驱动 disconnect（plan pressure_pass 已识别）。
- **P0 向后兼容**：`RuntimeErrorCode.DEVICE_OFFLINE === 'DEVICE_OFFLINE'`、`ENDPOINT_UNAVAILABLE === 'endpoint_unavailable'`，与 Phase 1 / P0 `verify-p0-chat-api.ts` 断言字面值完全一致。

## 验证证据

```
# Phase 2 集成测试（真实 DB agenthub_p0_test）
$ DATABASE_URL=postgresql://agenthub:***@localhost:5432/agenthub_p0_test npx tsx scripts/verify-p1-rt-phase2.ts
SUMMARY: 13 passed, 0 failed, 0 skipped, status=PASS
  - RuntimeErrorCode 4 项字面值一致
  - markChannelConnected → connected 行读回 + connected_at + endpoint_id
  - markChannelDisconnected → disconnected 且保留 connected_at
  - invoke 曾连接后断开 → tunnel_disconnected + runtime_status=DEVICE_OFFLINE
  - invoke 从未连接 → local_runtime_offline（不误报 tunnel_disconnected）

# Phase 1 回归
$ npx tsx scripts/verify-p1-runtime-gateway.ts
SUMMARY: 12 passed, 0 failed, 1 skipped, status=PASS

# type-check
$ cd packages/shared && npx tsc --noEmit   → exit 0
$ cd apps/web && npx tsc --noEmit           → exit 0
```

## 边界与未决

- **out of scope（未触及）**：Phase 3 public_cloud provider/部署基座（D-003）、Desktop RuntimeHost/StreamAdapter/DeviceChannel 主进程执行模型改写、新外部服务。
- 无阻塞问题；未触发 D-003 选型决策请求。
