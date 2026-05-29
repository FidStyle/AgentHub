# P1 Runtime — Cloud Runtime Gateway 架构合同（Revised）

> 状态：**revised plan / recommendation，未进入 execute**。
> 修订来源：用户澄清（2026-05-29）——Cloud Runtime Gateway 是必需实体，不是 optional provider。
> 取代原 plan（`PLN-20260529-p1-runtime`）中「HostedRuntimeAdapter 直连真实云端 runtime 服务」的隐含模型。

---

## 1. 架构模型修订（核心）

### 1.1 错误的旧模型

原 `analyze:ANL-20260529-p1-runtime` + `PLN-20260529-p1-runtime` 假设：

- HostedRuntimeAdapter 直接连接「某个真实云端 runtime 服务」
- CloudRuntimeAdapter 作为「optional provider」，选型（Modal/Fly/自建）= D-003 deferred（旧模型，已废弃）
- Web/Mobile 与 runtime 的关系是「adapter 直连服务」

该模型缺失了一个**必需中间实体**，导致 user_local（本地 Desktop runtime）无法被 Web/Mobile 访问。

### 1.2 修订后的正确模型

**Cloud Runtime Gateway / Relay 是必需实体**（类似 FRP）。它同时承载两类 runtime 入口：

```
          ┌─────────────────────────────────────────────┐
 Web /    │            Cloud Runtime Gateway             │
 Mobile ──┤  （统一入口；不允许直连本地端口）            │
          │                                              │
          │   route by endpoint.kind:                    │
          │   ┌──────────────┐   ┌────────────────────┐  │
          │   │ public_cloud │   │     user_local     │  │
          │   │ runtime 池   │   │  relay / tunnel    │  │
          │   └──────┬───────┘   └─────────┬──────────┘  │
          └──────────┼─────────────────────┼─────────────┘
                     │                      │ tunnel (现有 /ws/device)
              官方公共 runtime         ┌────▼─────────────┐
              （自建 Gateway/worker）   │ Desktop 本地 runtime │
                                       │ 监听本地端口      │
                                       └──────────────────┘
```

- **`public_cloud`**：AgentHub 官方公共 runtime 池（Claude Code / Codex 等）。部署基座固定为自建 Gateway / worker；不使用 Modal/Fly/Supabase/Neon/Upstash 等包装平台。
- **`user_local`**：用户自己的 Desktop 本地 runtime，**通过 cloud gateway relay/tunnel** 暴露给 Web/Mobile。
- **Web/Mobile 永不直连本地端口**，统一请求 Cloud Runtime Gateway。
- **Desktop 本地 runtime 监听本地端口**，但通过云端 gateway 建立 device/channel/tunnel（现有 `/ws/device` WebSocket 即此 tunnel 的雏形）。
- **`/api/chat`** 根据 workspace/session 的 `execution_domain` 或所选 runtime endpoint 路由到 cloud gateway；gateway 再决定调用 `public_cloud` runtime 还是转发到 `user_local` Desktop runtime。

### 1.3 与现有代码的映射

| 架构概念 | 现有代码 | 状态 |
|----------|----------|------|
| user_local tunnel（device channel） | `apps/web/server/ws-gateway.ts` + `apps/web/server/device-connections.ts`（`/ws/device`） | ✅ 雏形已存在（auth/heartbeat/runtime_invoke/runtime_cancel frame relay） |
| Web→gateway 调用入口 | `apps/web/lib/device-gateway-client.ts`（`sendRuntimeInvoke`/`sendRuntimeCancel`） | ✅ 部分存在（仅 user_local 方向） |
| `/api/chat` 路由 | `apps/web/app/api/chat/route.ts`（`execution_domain === 'local_desktop'` → DEVICE_OFFLINE stub；cloud → HostedRuntimeAdapter stub） | ⚠️ 两路都是 stub |
| public_cloud runtime 池 | 无 | ❌ 不存在（D-003 已决策为自建，待 Phase 3 实现） |
| HostedRuntimeAdapter | `apps/web/lib/runtime/hosted-adapter.ts`（minimal stub） | ⚠️ 应重定义为 **Gateway 客户端契约**，而非「直连服务」 |
| runtime endpoint / session / tunnel DB | 无 | ❌ 不存在 |

> 关键洞察：`HostedRuntimeAdapter` 不应「直连真实服务」，而应是 **Cloud Runtime Gateway 的客户端**。Gateway 负责 public_cloud vs user_local 的二级路由。

---

## 2. DB 实体建议（contract，未建表）

> 全部 `IF NOT EXISTS` 幂等；不得影响 P0 已验收的 `sessions`/`messages`/`workspaces`/`devices` 表。

| 表 | 用途 | 关键列（建议） |
|----|------|----------------|
| `runtime_endpoints` | 注册可用 runtime 入口（两类） | `id`, `user_id`(nullable for public), `kind`('public_cloud'\|'user_local'), `runtime_type`('hosted'\|'claude_code'\|'codex'), `device_id`(FK，user_local 用), `status`('available'\|'offline'\|'unconfigured'), `created_at` |
| `runtime_sessions` | 一次 runtime 执行的状态机 | `id`, `session_id`(FK sessions), `endpoint_id`(FK runtime_endpoints), `native_session_id`, `cwd`, `status`('idle'\|'running'\|'completed'\|'failed'\|'cancelled'), `started_at`, `completed_at` |
| `runtime_logs` | RuntimeEvent 流持久化 | `id`, `runtime_session_id`(FK), `event_type`, `payload`(jsonb), `seq`, `created_at` |
| `device_runtime_channels` | user_local tunnel 状态（替代 `runtime_tunnels` 命名，复用现有 device 概念） | `id`, `device_id`(FK devices), `endpoint_id`(FK runtime_endpoints), `status`('connected'\|'disconnected'), `connected_at`, `last_heartbeat` |
| `runtime_capabilities` | endpoint 能力声明 | `id`, `endpoint_id`(FK), `capability`(text), `value`(jsonb) |

> `device_runtime_channels` 与现有 `devices.online` / device-connections 内存态对齐：内存连接是实时态，DB 表是持久审计态。

---

## 3. API / 事件语义（统一）

`/api/chat` SSE 与 gateway 内部统一事件类型（在 `packages/shared/src/protocol/runtime-event.ts` 扩展或新增 gateway 层 event）：

| 事件 | 含义 | 触发点 |
|------|------|--------|
| `gateway_connected` | 请求已被 Cloud Runtime Gateway 受理 | gateway 入口 |
| `runtime_status` | 通用运行态（保留现有；status 取值收敛到枚举） | 全程 |
| `public_runtime_available` | public_cloud 池有可用 runtime | 路由到 public_cloud 时 |
| `endpoint_unavailable` | 选定 endpoint 不可用（通用） | 路由失败 |
| `local_runtime_offline` | user_local Desktop runtime 离线（取代裸 `DEVICE_OFFLINE` 字符串） | user_local tunnel 无连接 |
| `tunnel_connected` / `tunnel_disconnected` | user_local tunnel 建立/断开 | device channel 状态变更 |

> **向后兼容**：现有 `/api/chat` 返回 `runtime_status: 'DEVICE_OFFLINE'`。修订后 `local_runtime_offline` 为新语义事件，但需保留 `DEVICE_OFFLINE` 兼容期（P0 集成测试 `verify-p0-chat-api.ts` 断言依赖它）。建议：新增 `local_runtime_offline` 同时让 `runtime_status.status='DEVICE_OFFLINE'` 继续发出，或在测试中同步迁移断言。

---

## 4. Phase 切分（修订）

| Phase | 范围 | 可执行性 | D-003 关系 |
|-------|------|----------|------------|
| **Phase 1** | Cloud Runtime Gateway **contract + DB model + routing/event semantics**。HostedRuntimeAdapter 重定义为 gateway 客户端；`/api/chat` 按 endpoint 路由；runtime_endpoints/sessions/logs/channels/capabilities 落库；事件语义统一。**不要求真实部署平台。** | ✅ 可执行（无需 D-003） | 不阻塞 |
| **Phase 2** | Desktop local runtime tunnel/channel 正式接入 gateway（复用 `/ws/device`）；`device_runtime_channels` 持久化；`local_runtime_offline`/`tunnel_*` 事件闭环；错误码统一。 | ✅ 可执行（依赖 Phase 1 schema/事件） | 不阻塞 |
| **Phase 3** | 自建 public_cloud runtime pool / worker 实现。 | ✅ 可规划 | D-003 已决策为自建 |

### Phase 1 验收标准（revised，可执行）

1. `runtime_endpoints` / `runtime_sessions` / `runtime_logs` / `device_runtime_channels` / `runtime_capabilities` 表存在且幂等迁移，不影响 P0 表。
2. HostedRuntimeAdapter 重构为 **Gateway 客户端契约**：按 endpoint.kind 暴露路由接口；未配置 public_cloud 时明确返回 `endpoint_unavailable` / `public_runtime_available=false`，**不连接任何真实部署平台**。
3. `/api/chat` 按 workspace `execution_domain` / selected endpoint 路由到 gateway 逻辑；user_local 走现有 device relay，cloud 走 public_cloud 占位路由。
4. RuntimeEvent / gateway 事件语义统一（§3 事件全部定义在 shared 协议）。
5. type-check 通过；`/api/chat` 集成测试覆盖新路由 + 事件 + runtime_sessions 落库；DB 迁移幂等性验证。
6. **不跨越**：真实 public_cloud worker 部署、Desktop 进程管理主链路改写。

---

## 5. D-003 决策

| | 旧 | 新（修订） |
|--|----|-----------|
| D-003 问题 | 「是否需要 cloud provider」/「Cloud runtime 服务选型 Modal/Fly/自建」 | **全部自建：Cloud Gateway / runtime worker / DB / cache 使用官方镜像或开源实现自部署** |
| Cloud Gateway 本身 | （未建模） | **必需实体，不再 deferred** |
| deferred 范围 | 整个 cloud adapter | 不再做托管平台选型；Phase 3 直接实现自建 public_cloud worker/pool |

用户决策（2026-05-29）：AgentHub 不依赖 Supabase/Fly/Neon/Upstash 等包装平台。PostgreSQL 使用自建 Postgres（本地 Docker 或自管服务器），Redis 使用官方 Redis 或开源替代自部署，public_cloud Runtime 使用自建 Gateway / worker。

---

## 6. 不回改保证

- Out of scope（全程不触及）：P0-END-TO-END-PRODUCT-FLOW / UI-ALIGN-001 / mobile-pwa fixture 已闭环代码。
- 不修改 Desktop 本地 `RuntimeHost` / `StreamAdapter` / `DeviceChannel` 主链路，除非类型接口必须兼容。
- 本修订仅产出 `research/` + `.workflow/`，无产品代码改动；execute 待用户确认后另行启动。
