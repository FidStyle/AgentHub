# 模块调研：三端客户端壳与代码共享

**日期：** 2026-05-21  
**状态：** Draft  
**覆盖 FR-ID：** `FR-DEVICE-001`, `FR-WEB-001`, `FR-DESK-001`, `FR-MOB-001`, `FR-ARTIFACT-001`, `FR-NOTIFY-001`  
**相关产品设计：** `research/product-design.md` 第 4-6 章

---

## 1. 调研问题

AgentHub P0 明确要求 Web、Desktop、Mobile 三端同时存在，但三端职责不同：

- Web 是完整三栏 IM 主工作台。
- Desktop 是本地 Connector Console。
- Mobile 是轻量 IM、审批和预览端。

本模块需要回答：

1. Web 用什么应用框架承载主工作台？
2. Desktop 用 Electron 还是 Tauri？
3. Mobile P0 是响应式 Web/PWA、React Native/Expo，还是复用 Tauri Mobile？
4. 如果后续要做成 Android 应用，如何避免推翻 P0 移动端实现？
5. 三端是否共用 UI 和领域模型？

---

## 2. 候选方案

### 2.1 Web 主工作台

| 方案 | 优点 | 风险 | 适配度 |
| --- | --- | --- | --- |
| Next.js App Router | 适合全栈 Web、Auth、API、SSR/静态混合；生态成熟 | 项目初期约束较多，客户端 IM 复杂状态仍需单独设计 | 高 |
| Vite + React SPA | 启动快、适合纯前端工作台；简单直接 | 后端/API/Auth 需要单独搭建 | 中 |
| Remix / React Router 全栈 | 路由和数据加载清晰 | 生态和团队熟悉度可能弱于 Next.js | 中 |

**推荐：** Next.js App Router 作为 Web 主应用。P0 的 Web 同时需要登录、Workspace、IM、API 接入和 Preview 面板，Next.js 便于把 Web 与后端 BFF/API 合并启动。

### 2.2 Desktop Connector

| 方案 | 优点 | 风险 | 适配度 |
| --- | --- | --- | --- |
| Electron | Node.js 能力天然适合调用 CLI、管理进程、访问文件；成熟生态；参考项目多 | 包体大、资源占用高 | 高 |
| Tauri 2 | 包体轻、安全边界更强；官方支持 desktop/mobile 方向 | Rust/插件心智增加复杂度；Node CLI/PTY 集成需要额外桥接 | 中 |
| 纯 Node CLI + Web 配置页 | 最小可行、实现快 | 不满足 Desktop 端产品存在感和 Connector Console 要求 | 中 |

**推荐：** P0 使用 Electron。理由是 Desktop 的关键任务是本地文件夹授权、Claude Code/Codex CLI 检测、进程执行、Action 输出采集和云端连接。Electron 的 Node 主进程模型最直接，能减少 P0 技术不确定性。

**保留：** 如果后续强调轻量和安全，可在 P2 评估 Tauri 2 替换或新增 Tauri Connector。

### 2.3 Mobile

| 方案 | 优点 | 风险 | 适配度 |
| --- | --- | --- | --- |
| 响应式 Web/PWA | 最快交付；与 Web 共用路由、组件和状态；符合 P0 轻量 IM/审批；Android 浏览器可直接访问或安装到桌面 | 原生 Push、系统集成弱；不是应用商店意义上的原生 App | 高 |
| Capacitor Android 壳包 Web/PWA | 保留 Web 实现，可输出 Android App/APK；比 React Native 迁移成本低 | 需要 Android Studio/JDK/Gradle；原生体验仍受 WebView 限制 | 中 |
| React Native / Expo | 移动体验好，Push 和原生能力成熟 | P0 成本高，需要维护独立端；Web 组件无法直接复用 | 中 |
| Tauri Mobile | 与 Tauri Desktop 有统一想象 | 对 P0 风险高，生态和团队成本不必要 | 低 |

**推荐：** P0 使用响应式 Web/PWA 形态交付 Mobile。Mobile P0 不接本地 Runtime，也不做复杂代码编辑，主要是消息、审批、预览，PWA 足够验证产品闭环。

**Android App 预留：** 如果后续交付物要求“安装到安卓手机的应用”，优先使用 Capacitor 包装同一套移动 Web/PWA 页面，输出 Android App/APK。这样需要 Android Studio、JDK、Gradle 等 Android 工具链，但不需要重写移动端业务逻辑。iOS 是否支持可作为 P2 决策，因为需要 Apple 开发者账号、Xcode 和更严格的审核/签名链路。

### 2.4 React-first 代码共享边界

AgentHub 可以采用 React-first 的产品工程路线，但必须区分“业务逻辑复用”和“UI 组件复用”。

| 层级 | P0 复用方式 | 未来 React Native/Expo 复用性 |
| --- | --- | --- |
| Domain Types | `packages/shared` 统一定义 Workspace、Session、Message、Artifact、Action、Permission、Runtime 类型 | 可直接复用 |
| State Machine | 消息状态、Action 状态、权限判断、Workspace 执行域规则使用纯 TypeScript | 可直接复用 |
| API Client | Web/Desktop/Mobile PWA 共用 API client | 可大部分复用 |
| Hooks | 不依赖 DOM 和浏览器 API 的 hooks 可放入 shared | 可部分复用 |
| Web UI Components | Next.js/React DOM 组件、CSS、Tailwind、浏览器 API | 不承诺复用 |
| Native UI Components | P0 不做 | React Native/Expo 阶段重写 |

推荐代码组织方向：

```text
apps/web
  Next.js Web + Mobile PWA UI

apps/desktop
  Electron + React Connector Console UI

packages/shared
  domain types
  API client
  message/action/artifact state machines
  permission and execution-domain rules

future apps/mobile-native
  React Native / Expo UI
  reuse packages/shared
```

结论：P0 应该 all in React/TypeScript 生态，但不要把 Web DOM 组件设计成“未来可直接迁移 React Native”。真正值得提前做的是把复杂业务对象和状态流从 UI 层剥离出来。

---

## 3. 推荐路线

P0 推荐：

- Web：Next.js App Router + React + TypeScript。
- Desktop：Electron + React + TypeScript，主进程负责本地能力，渲染进程负责 Connector Console。
- Mobile P0：同一 Next.js Web 应用的移动响应式/PWA 路由。
- Mobile P1/P2：如需 Android App，使用 Capacitor 包装移动 Web/PWA；React Native/Expo 仅在需要大量原生能力时再评估。
- 共享：抽出 `packages/shared` 或等价目录承载领域类型、FR-ID 常量、消息/Artifact/Action 状态枚举、权限规则、Workspace 执行域规则和 API client。
- 未来原生移动端：如选择 React Native/Expo，应复用 `packages/shared`，但重写移动 UI。

---

## 4. 产品约束映射

| 产品约束 | 技术映射 |
| --- | --- |
| Desktop 不是 Web 克隆 | Electron 仅实现 Connector Console 页面，不复刻三栏工作台 |
| Mobile 不接 Runtime | Mobile 路由不暴露 Runtime 检测、文件夹选择、CLI 执行 |
| 三端共享 Session 数据 | Web/Mobile 调后端 API；Desktop 通过设备通道同步执行状态 |
| Web 是主功能区 | 三栏 IM、Artifact、Context、Agents、Preview 优先在 Web 完整实现 |
| 后续 Android 应用兼容 | 移动端业务先做成清晰的移动 Web 路由，便于 Capacitor 包装 |
| 后续 React Native 兼容 | 共享纯 TypeScript 领域层和状态机，UI 层按平台重写 |

---

## 5. 参考项目校准

参考 `research/modules/reference-projects.md`：

- LobeHub 使用 Next.js/React，同时区分 `entry.web.tsx`、`entry.mobile.tsx`、`entry.desktop.tsx` 和 route segments，证明 Web/Mobile/Desktop 可以共享技术栈但分入口组织。
- Cherry Studio 使用 Electron main/renderer/preload，并用 `packages/shared` 管理跨进程 types、constants、IPC channel definitions。
- codeg 通过 `lib/transport` 抽象 Tauri invoke、Web fetch/WebSocket、remote desktop transport，证明 shared transport/API client 层是必要的。

这些参考支持当前结论：P0 应 all in React/TypeScript 生态，但 UI 按端分化，复杂领域模型和 transport/API client 进入 `packages/shared`。

---

## 6. 待用户确认

**推荐确认项：**

A. 接受 P0 技术路线：Web Next.js、Desktop Electron、Mobile PWA，并预留 Capacitor Android App 包装路线。  
B. 希望 Desktop 优先 Tauri，即使 Runtime/CLI 接入成本更高。  
C. 希望 Mobile 从 P0 就做 React Native/Expo 独立 App。

我的建议是 **A**。这条路线最稳，最符合 P0 时间压力和产品职责分工。

---

## 7. 参考资料

- Electron 官方文档：https://www.electronjs.org/docs/latest/
- Tauri 2 官方文档：https://v2.tauri.app/
- Next.js 官方文档：https://nextjs.org/docs
- React Native 官方文档：https://reactnative.dev/docs/getting-started
- Expo 官方文档：https://docs.expo.dev/
