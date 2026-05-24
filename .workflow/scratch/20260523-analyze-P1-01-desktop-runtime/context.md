# Context: Phase 1 -- Desktop Connector + Runtime Adapter

**Date**: 2026-05-23
**Areas discussed**: DeviceChannel 协议, 设备绑定, WebSocket Gateway, Runtime 检测, 流式事件回传

## Decisions

### Decision 1: WebSocket Gateway 实现方式
- **Context**: Next.js App Router 不原生支持 WebSocket，需要选择 Gateway 实现方案
- **Options**:
  1. Next.js custom server (express/ws)
  2. 独立 WebSocket 微服务
  3. Supabase Realtime Channel (自定义 presence)
- **Chosen**: Next.js custom server + ws 库
- **Reason**: 保持单体部署简单性，P0 不需要独立微服务；Supabase Realtime 不支持自定义帧协议

### Decision 2: Runtime 流式输出方案
- **Context**: 当前 LocalRuntimeAdapter 使用 exec (等待完成)，需要支持流式
- **Options**:
  1. spawn + readline (逐行流式)
  2. spawn + stdout pipe (原始流)
  3. CLI --json-stream 模式 (如果 CLI 支持)
- **Chosen**: spawn + readline 逐行解析
- **Reason**: 兼容性最好，Claude Code 和 Codex 都输出文本行；后续可升级到 JSON stream

### Decision 3: 设备绑定安全模型
- **Context**: Desktop 需要与 Web 账号关联，需要安全的绑定流程
- **Options**:
  1. 6 位数字绑定码 (5 分钟过期)
  2. QR 码扫描
  3. OAuth device flow
- **Chosen**: 6 位数字绑定码
- **Reason**: 实现简单，用户体验直观，安全性足够 (短过期 + 一次性使用)

## Constraints

### Locked
- DeviceChannel P0 底层直接使用 WebSocket (research/technical-design.md)
- Desktop 是 Connector，不复制三栏工作台
- Electron renderer 不直接访问文件系统，只通过 preload typed IPC
- Runtime Adapter 接收结构化 ContextPackage + RuntimeInvokeInput，不接收裸 prompt
- Web/Mobile 不与 Desktop 做点对点直连，控制请求统一进入后端再通过 DeviceChannel 下发
- Desktop 只接受后端签发、scope 匹配、workspace 匹配的请求

### Free
- WebSocket 心跳间隔 (建议 30s)
- Runtime 检测轮询频率 (建议启动时 + 每 60s)
- Connector Console UI 布局细节
- 绑定码位数 (建议 6 位)

### Deferred
- OpenCode Adapter (P1/P2 预留)
- 多设备同时在线冲突策略
- Desktop 自动更新机制
- Native session discovery (读取 ~/.claude 目录)

## Code Context

已有代码基础：
- `apps/desktop/src/main/index.ts` — Electron 主进程，已注册 runtime IPC
- `apps/desktop/src/main/runtime/local-adapter.ts` — 基础 exec 执行器
- `apps/desktop/src/main/runtime/ipc.ts` — IPC handler 注册
- `apps/desktop/src/preload/index.ts` — typed bridge 暴露 runtime API
- `apps/desktop/src/renderer/App.tsx` — 基础 Connector Console UI (中文)
- `packages/shared/src/domain/device.ts` — Device 类型定义
- `packages/shared/src/domain/runtime.ts` — RuntimeType, RuntimeBinding, RuntimeSession
- `packages/shared/src/runtime/adapter.ts` — RuntimeAdapter 接口, RuntimeResult

需要新建：
- `packages/shared/src/protocol/` — DeviceChannel 帧类型、RuntimeEvent、序列化
- `apps/web/app/api/devices/` — 设备绑定 API
- `apps/web/server/` — WebSocket Gateway (custom server)
- `apps/desktop/src/main/device-channel.ts` — WebSocket 客户端
- `apps/desktop/src/main/runtime/runtime-host.ts` — 流式 Runtime 宿主
