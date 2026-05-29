# P1-RT — Cloud Runtime Gateway 架构修订报告（Revised Plan）

> 状态：**revised plan / recommendation，止步未 execute**。日期：2026-05-29。

## 概要

| 字段 | 值 |
|------|-----|
| 任务 ID | P1-RT |
| 阶段 | 架构模型修订（revised plan） |
| 触发 | 用户澄清：Cloud Runtime Gateway 是必需实体，非 optional provider |
| 取代 | 旧模型「HostedRuntimeAdapter 直连真实云端服务」（`PLN-20260529-p1-runtime`） |
| 最终状态 | 🔄 修订完成，等待用户确认后再 execute |
| 权威合同 | `research/contracts/P1-RUNTIME-GATEWAY.md` |

## 为什么停在 revised plan

执行 Phase 1 细化时发现**原 plan 的架构模型有缺陷**，且与本次 intent 直接冲突：

1. 原 plan TASK-002 验收要求「HostedRuntimeAdapter 连接真实云端 runtime 服务，返回真实响应而非 minimal_adapter」。
2. 但 intent 要求 D-003（cloud provider 选型）deferred、不实现部署 → 连接真实服务必然先定 provider，二者冲突。
3. 第一轮提出「provider_unconfigured 边界版」（adapter 只暴露契约不连服务）后，用户进一步澄清：**真正缺失的不是「provider 是否 deferred」，而是整个架构缺少 Cloud Runtime Gateway 这个必需中间实体**。

按用户指令「先 revised plan，不进入 execute」，本轮仅修订 research 合同 / roadmap / tracker / report，不改产品代码。

## 架构修订要点

| 维度 | 旧模型 | 修订后 |
|------|--------|--------|
| 中间实体 | 无（adapter 直连服务） | **Cloud Runtime Gateway 必需**（FRP 式 relay） |
| runtime 入口 | 单一「cloud 服务」 | 两类 endpoint：`public_cloud` + `user_local` |
| user_local 可达性 | 无法被 Web/Mobile 访问 | 经 gateway tunnel relay 暴露 |
| Web/Mobile→runtime | adapter 直连 | 统一请求 gateway，永不直连本地端口 |
| HostedRuntimeAdapter | 直连真实服务 | 重定义为 **gateway 客户端契约** |
| D-003 | 是否需 cloud provider / 服务选型 | **Gateway 部署基座选型**（Modal/Fly/自建/其他），仅 public_cloud 池部署 deferred |
| Gateway 实体 | 未建模 | **不再 deferred，是 Phase 1 核心** |

## 与现有代码的衔接（已核实）

- `apps/web/server/ws-gateway.ts` + `device-connections.ts`（`/ws/device` WebSocket）= **user_local tunnel 雏形已存在**（auth/heartbeat/runtime_invoke/runtime_cancel frame relay）。
- `apps/web/lib/device-gateway-client.ts` = Web→device relay 入口（仅 user_local 方向）。
- `apps/web/app/api/chat/route.ts` = 两路均 stub（local_desktop→DEVICE_OFFLINE；cloud→HostedRuntimeAdapter minimal stub）。
- `apps/web/lib/runtime/hosted-adapter.ts` = minimal stub（只 yield 'minimal_adapter'）。
- public_cloud runtime 池、runtime endpoint/session/tunnel DB = **不存在**。

## Phase 切分（修订）

- **Phase 1**（可执行，无需 D-003）：Gateway contract + DB model（runtime_endpoints / runtime_sessions / runtime_logs / device_runtime_channels / runtime_capabilities）+ routing/event semantics。HostedRuntimeAdapter→gateway 客户端；`/api/chat` 按 endpoint 路由；统一事件语义。**不要求真实部署平台。**
- **Phase 2**（依赖 P1）：Desktop local runtime tunnel/channel 正式接入 gateway；channel 持久化；错误码统一。
- **Phase 3**（blocked by D-003）：public cloud runtime 池部署基座选型与实现。

详见 `research/contracts/P1-RUNTIME-GATEWAY.md` §2-§5（DB 实体、事件语义、Phase 验收标准、D-003 重定义）。

## 本轮产出（仅 research/.workflow，无产品代码）

| 文件 | 变更 |
|------|------|
| `research/contracts/P1-RUNTIME-GATEWAY.md` | 新增（权威架构合同） |
| `.workflow/roadmap.md` | M:P1-RT 段重写为 Gateway 模型 |
| `research/project-tracker.md` | P1-RT 条目 + 变更历史更新 |
| `research/execution-reports/p1-rt-gateway-revised-plan-report.md` | 本报告 |

## 不回改保证

- 未触及 P0-END-TO-END-PRODUCT-FLOW / UI-ALIGN-001 / mobile fixture 已闭环代码。
- 未修改 Desktop 本地 RuntimeHost/StreamAdapter/DeviceChannel 进程主链路。
- 无产品代码改动；execute 待用户确认架构模型后另行启动。

## 下一步（待用户确认）

1. 确认修订后的 Cloud Runtime Gateway 架构模型与 Phase 1 范围。
2. 确认后 `/maestro-plan` 细化 Phase 1（Gateway contract + DB + 路由/事件语义）→ 进入 execute。
3. Phase 3 待 D-003「Gateway 部署基座选型」决策。
