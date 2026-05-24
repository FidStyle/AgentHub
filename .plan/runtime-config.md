# Desktop Runtime 配置页面实现计划

## 目标
为 Desktop 应用添加 Runtime 配置页面，参考 AionUi 和 codeg 的模式，让用户可以配置 Claude Code 和 Codex 的认证、环境变量等。

## 架构设计

### 1. Main Process - 配置持久化
**新建文件**: `src/main/runtime/runtime-config-store.ts`
- 使用 `app.getPath('userData')` + JSON 文件持久化
- 存储结构:
```ts
interface RuntimeConfig {
  claude_code: {
    enabled: boolean
    authMode: 'official' | 'api_key'
    env: Record<string, string>  // ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, ANTHROPIC_MODEL
    nativeConfig: Record<string, unknown>  // effortLevel 等
  }
  codex: {
    enabled: boolean
    authMode: 'default' | 'api_key'
    env: Record<string, string>  // OPENAI_API_KEY, OPENAI_BASE_URL
    nativeConfig: Record<string, unknown>
  }
}
```
- IPC handlers: `runtime-config:get`, `runtime-config:save`, `runtime-config:test`

### 2. Preload - 暴露 API
**修改文件**: `src/preload/index.ts`
- 添加 `runtimeConfig` namespace:
  - `getConfig()` → 读取全部 runtime 配置
  - `saveConfig(type, config)` → 保存单个 runtime 配置
  - `test(type)` → 测试 Runtime 连通性（跑 `claude --version` / `codex --version`）

### 3. Renderer - 配置 UI
**新建文件**: `src/renderer/components/RuntimeConfigPage.tsx`
- 每个 Runtime 一个可展开卡片（参考 codeg collapsible 模式）
- 卡片内容:
  - 顶部: 图标 + 名称 + 状态 Badge + Enable 开关
  - 认证模式选择（官方订阅 / 自定义 API Key）
  - API Key 输入（密码模式 + 显示/隐藏 toggle）
  - Base URL 输入（可选，默认留空用官方）
  - Model 输入
  - 高级区域(collapsible): 原始环境变量编辑(textarea, KEY=VALUE格式)
  - 底部: "测试连接" 按钮 + "保存" 按钮
- 测试结果显示 pass/fail badge

**修改文件**: `src/renderer/App.tsx`
- 添加 tab 导航: "连接器" | "Runtime 配置"
- 切换显示不同内容

### 4. 执行时注入环境变量
**修改文件**: `src/main/runtime/stream-adapter.ts`
- `execute()` 方法启动子进程时，读取对应 runtime 的 env 配置并注入 `process.env`

## 实现顺序
1. `runtime-config-store.ts` - 配置存储层 + IPC 注册
2. `preload/index.ts` - 暴露 IPC API
3. `RuntimeConfigPage.tsx` - 配置 UI
4. `App.tsx` - 添加 tab 导航
5. `index.ts` - 初始化时加载 config store
6. `stream-adapter.ts` - spawn 时注入用户 env

## 文件清单
| 操作 | 文件 |
|------|------|
| 新建 | `apps/desktop/src/main/runtime/runtime-config-store.ts` |
| 新建 | `apps/desktop/src/renderer/components/RuntimeConfigPage.tsx` |
| 修改 | `apps/desktop/src/preload/index.ts` |
| 修改 | `apps/desktop/src/renderer/App.tsx` |
| 修改 | `apps/desktop/src/renderer/components/ConnectionStatus.tsx` (类型声明扩展) |
| 修改 | `apps/desktop/src/main/index.ts` |
| 修改 | `apps/desktop/src/main/runtime/stream-adapter.ts` |
