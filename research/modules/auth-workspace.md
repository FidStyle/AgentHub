# 模块调研：身份、Workspace 与执行域

**日期：** 2026-05-21  
**状态：** Draft  
**覆盖 FR-ID：** `FR-AUTH-001`, `FR-WS-001`, `FR-DEVICE-001`, `FR-PERM-001`  
**相关产品设计：** `research/product-design.md` 第 3、7、9 章

---

## 1. 调研问题

AgentHub P0 已确定使用 GitHub OAuth，不做独立用户名密码。Workspace 必须在创建时绑定唯一执行域：Cloud 或 Local Desktop。本模块需要回答：

1. 身份认证用自建 OAuth、Auth.js，还是 Auth.js？
2. Workspace 执行域如何在数据模型和 UI 中强约束？
3. Desktop Connector 如何绑定到同一用户身份？
4. Local Desktop Workspace 如何让 Web/Mobile 可远程控制，同时避免 Web/Mobile 进程直接成为本地文件或本地端口访问入口？

---

## 2. 身份认证候选方案

| 方案 | 优点 | 风险 | 适配度 |
| --- | --- | --- | --- |
| Auth.js / NextAuth + GitHub Provider | 与 Next.js 集成自然；可自持 DB；控制力强 | 需要自己处理设备绑定和会话同步细节 | 高 |
| Auth.js + GitHub OAuth | 快速获得 Auth、Session、DB、Realtime 组合能力 | 平台绑定更强；本地 Demo 依赖外部服务 | 高 |
| 自建 GitHub OAuth | 控制最强 | 安全、回调、token 管理重复造轮子 | 低 |

**推荐：** Auth.js v5 + GitHub OAuth Provider。本地开发仅需 GitHub OAuth App credentials + local Postgres，不依赖 external BaaS 控制台。

> 决策已确认（DEC-001）：P0 采用 Auth.js v5，消除本地开发/E2E 对外部 Auth 服务的强依赖。

---

## 3. Workspace 执行域模型

### 3.1 核心枚举

```typescript
type WorkspaceExecutionDomain = 'cloud' | 'local_desktop';
```

### 3.2 关键约束

| 约束 | 实现含义 |
| --- | --- |
| Workspace 创建后执行域不可变 | 避免 Session、Runtime、Action 历史混乱 |
| Session 继承 Workspace 执行域 | Session 不单独选择 Cloud/Local |
| Role Agent Runtime 必须匹配执行域 | Cloud Workspace 不可绑定本地 Claude Code/Codex |
| Action 执行位置必须匹配执行域 | Cloud 走云端执行，Local Desktop 走 Desktop Connector |
| Web/Mobile 是控制端而不是本地执行端 | 用户可以在 Web/Mobile 发起会影响本地 Workspace 的消息、审批和 Action；本地文件读写、命令执行和 Runtime 调用必须经 Cloud Runtime Gateway 转发到在线 Desktop Connector 执行 |
| 本地 Runtime 不暴露给 Web/Mobile 直连 | Local Desktop Workspace 的 `user_local` runtime endpoint 只通过 Cloud Runtime Gateway + Desktop DeviceChannel/tunnel 暴露 |

对应需求：`FR-WS-001`, `FR-RUNTIME-001`, `FR-ACTION-001`。

---

## 4. Desktop 设备绑定

候选方案：

| 方案 | 优点 | 风险 | 推荐 |
| --- | --- | --- | --- |
| Desktop 内嵌浏览器 OAuth | 用户理解成本低 | OAuth 回调和桌面深链处理较繁琐 | 可选 |
| Device Code Flow / 一次性绑定码 | 适合 CLI/Desktop；避免复杂回调 | 需要后端实现设备绑定票据 | 推荐 |
| 用户复制 token | 实现快 | 安全和体验差 | 不推荐 |

**推荐：** P0 支持 Web 登录后生成一次性设备绑定码，Desktop 输入或扫码绑定；后续可补 Desktop 直接 GitHub OAuth。

注意：PRD 写的是「Desktop 支持 GitHub 登录或绑定同一 AgentHub 账号」，所以设备绑定码不违背 `FR-AUTH-001`。

---

## 5. 推荐路线

P0 推荐：

- Auth：Auth.js v5 + GitHub OAuth Provider。本地开发仅需 GitHub OAuth App credentials + local Postgres，不依赖 external BaaS 控制台。
- DB：PostgreSQL（生产可用 Postgres，本地开发用 local Postgres），Workspace/Session/Role Agent/Action/Pending Approval 使用统一用户 ID。
- Workspace 执行域：数据库字段强约束 + 服务层校验 + UI 禁用不合法选择；P1 Runtime Gateway 中，`cloud` 默认路由 `public_cloud` endpoint，`local_desktop` 默认路由 `user_local` endpoint。
- Desktop 绑定：一次性设备绑定码，绑定后获得 device token。
- 本地目录权限：Desktop 只暴露用户选择的 workspace root；后端只保存目录标识和展示名，不保存任意可写路径能力。

---

## 6. 待用户确认

**推荐确认项：**

~~A. P0 使用 Auth.js + GitHub OAuth + Postgres，加速三端同步。~~
**B. 使用 Auth.js v5 + GitHub OAuth + local Postgres，控制力强且本地零依赖。** ✅ 已采纳（DEC-001）
~~C. 自建 GitHub OAuth，不依赖认证框架。~~

最终选择 **B**。Auth.js v5 消除 external BaaS 控制台依赖；DB/Realtime 仍使用 Postgres。

---

## 7. 参考资料

- GitHub OAuth Apps 文档：https://docs.github.com/en/apps/oauth-apps
- Auth.js 文档：https://authjs.dev
- Auth.js GitHub Provider 文档：https://authjs.dev/getting-started/providers/github
