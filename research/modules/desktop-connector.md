# 模块调研：Desktop Connector 与本地执行边界

**日期：** 2026-05-21  
**状态：** Draft  
**覆盖 FR-ID：** `FR-DESK-001`, `FR-WS-001`, `FR-RUNTIME-001`, `FR-ACTION-001`, `FR-PERM-001`, `FR-NOTIFY-001`  
**相关产品设计：** `research/product/product-design.md` 第 5、7、8、9 章

---

## 1. 调研问题

Desktop Connector 是 Local Desktop Workspace 的本地能力边界。它必须完成：

- 绑定同一用户身份。
- 选择并授权本地 Workspace 文件夹。
- 检测 Claude Code 和 Codex。
- 执行已批准的本地 Runtime 和 Action 请求。
- 把状态和结果回传 Web/Mobile。

本模块需要回答：Desktop 如何连接云端、如何执行请求、如何限制本地文件访问。

---

## 2. Connector 通信模式候选方案

| 方案 | 优点 | 风险 | 适配度 |
| --- | --- | --- | --- |
| Desktop 主动 WebSocket 长连接 Cloud Runtime Gateway | 云端不需要直接连用户电脑；符合安全边界；适合 runtime relay、任务下发、状态回传和取消事件 | 需要心跳、断线重连、消息确认 | 高 |
| 云端直接访问 Desktop 本地端口 | 实现某些场景简单 | 穿透、防火墙、安全风险高 | 低 |
| Desktop 定时轮询任务队列 | 实现简单，易调试 | 延迟较高，流式状态弱 | 中 |

**推荐：** P0 直接使用 Desktop 主动发起的 WebSocket 长连接。P1 Runtime Gateway 修订后，这条连接是 `user_local` runtime endpoint 的 tunnel/relay 基础；Web/Mobile 仍只请求 Cloud Runtime Gateway，不直接访问 Desktop 本地端口。

`DeviceChannel` 不是一种独立协议，而是代码里的接口抽象；它的 P0 实现就是 WebSocket。

抽象的目的不是绕开 WebSocket，而是避免后续把鉴权、心跳、重连、消息确认、轮询降级等细节散落到 Runtime Adapter 或 Action Executor 里。

### 2.1 DeviceChannel 和 WebSocket 的关系

```text
DeviceChannel = 代码层接口
WebSocketDeviceChannel = P0 推荐实现
PollingDeviceChannel = 仅作为开发调试或降级方案，不作为主路线
```

接口建议：

```typescript
interface DeviceChannel {
  connect(deviceToken: string): Promise<void>;
  send(event: DeviceEvent): Promise<void>;
  onRequest(handler: (request: DeviceRequest) => Promise<void>): void;
  heartbeat(): Promise<DeviceHeartbeat>;
  disconnect(): Promise<void>;
}
```

这样技术设计可以明确「直接做 WebSocket」，同时保留后续替换底层传输或增加降级方案的能力。

---

## 3. 本地执行边界

Desktop 必须执行以下约束：

- 只允许访问用户绑定的 workspace root。
- 本地 Runtime 和 Action 的 working directory 必须在 workspace root 内。
- 高风险动作执行前必须有 Pending Approval。
- 执行请求必须携带 Workspace、Session、请求方、权限等级。
- Desktop 不接受未认证用户或不匹配 Workspace 的请求。
- Web/Mobile 发起本地 Runtime 请求时，必须先进 Cloud Runtime Gateway，再经已认证 Desktop DeviceChannel/tunnel 下发；不能保存或直连用户本机 IP/端口。

对应需求：`FR-WS-001`, `FR-ACTION-001`, `FR-PERM-001`, `NFR-SEC-001`。

---

## 4. Desktop 页面与服务拆分

建议 Desktop 内部拆分：

| 模块 | 职责 |
| --- | --- |
| Auth/Device Binding | 绑定 GitHub 用户或设备码 |
| Workspace Folder Manager | 选择本地目录、校验路径、记录授权 root |
| Runtime Detector | 检测 Claude Code、Codex 命令是否可用、版本、认证状态和能力声明 |
| Device Channel | 连接 Cloud Runtime Gateway、接收请求、回传状态 |
| Local Executor | 执行 Action/CLI 请求 |
| Runtime Adapter Host | 调用 Claude Code/Codex Adapter |
| Audit View | 显示最近执行、失败原因、审批状态 |

---

## 5. 推荐路线

P0 推荐：

- Desktop 壳：Electron。
- 云端通道：抽象 `DeviceChannel` 接口，P0 使用 `WebSocketDeviceChannel` 作为主实现；P1 起作为 Cloud Runtime Gateway 的 `user_local` tunnel。
- 执行：Node 子进程执行 CLI，统一采集 stdout/stderr/exit code。
- 凭证边界：P0 不在 Desktop 配置页托管本地 Claude Code / Codex API Key；Desktop 只检测原生 CLI 是否已完成认证，并在失败时给出登录或安装引导，不在 App 内代执行 CLI 登录、设备码轮询或 OAuth 代理流程。
- 文件边界：所有路径先 resolve，再检查是否位于 workspace root。
- 状态：执行事件回写 Action/Message/Task Result 数据。
- 通知：P0 站内队列；Desktop 系统通知放 P1。

---

## 6. 参考项目校准

参考 `research/modules/reference-projects.md`：

- LobeHub `packages/device-gateway-client/src/client.ts` 使用 WebSocket 主动连接云端，包含 auth、heartbeat、reconnect、missed heartbeat。
- LobeHub `packages/device-gateway-client/src/types.ts` 已定义 `tool_call_request`、`system_info_request`、`agent_run_request` 等协议消息。
- LobeHub `apps/desktop/src/main/controllers/GatewayConnectionCtr.ts` 把远程请求路由到本地文件、Shell command、Claude/Codex agent run。
- codeg `src/lib/transport/types.ts` 证明 transport 层需要 `call`、`subscribe`、`onReconnect`、`waitForReady`、`eventStream` 这类恢复能力，而不是裸 WebSocket 调用。

这些参考支持当前结论：AgentHub P0 应直接使用 WebSocket 实现 Desktop 设备通道，但用 `DeviceChannel` 封装连接生命周期和消息协议。

---

## 7. 待用户确认

**推荐确认项：**

A. P0 Desktop 使用 Electron，`DeviceChannel` 作为接口，底层直接实现 WebSocket 长连接。  
B. P0 先用轮询，后续升级 WebSocket。  
C. P0 只做本地 CLI，不做桌面壳。

我的建议是 **A**。它能直接满足远程控制和状态回传，不引入轮询体验债，同时保留接口抽象。

---

## 8. 参考资料

- Electron 官方文档：https://www.electronjs.org/docs/latest/
- Node.js child_process 文档：https://nodejs.org/api/child_process.html
- Tauri 2 官方文档：https://v2.tauri.app/
