# 组件规范

> AgentHub 前端组件的实现方式。涉及 UI 的任务还必须读取 `./ui-style-guidelines.md` 和 `research/product/ui-design-system.md`。

---

## 概览

组件必须服务于 PRD 中的 `FR-ID`，不能为了局部页面临时堆样式。P0 组件基线为 `shadcn/ui + Tailwind CSS 4 + lucide-react`。

优先顺序：

1. 复用现有项目组件。
2. 复用或改造已授权参考项目中的组件/模块实现。
3. 按 shadcn/ui 模式抽取可组合组件。
4. 页面内写小型私有组件。
5. 只有在确实无法复用时，才新增组件变体。

### Convention: 已授权参考组件优先复用

**What**: `refer_proj/` 中已纳入项目参考范围、且用户明确授权的组件和模块，可以直接复用实现思路或代码结构，再按 AgentHub 的产品模型、类型、中文文案和样式系统改造。

**Why**: Markdown 渲染、消息气泡、代码块复制、审批卡、任务状态卡等通用能力不应重复从零试错。实现时优先把可复用部分落成本项目组件，而不是因为许可顾虑停在讨论阶段。

**Rules**:

- 复用时必须改成 AgentHub 的领域类型和 props，不能把参考项目的数据模型、路由、全局 store 或运行时假设原样带入。
- 复用 UI 时必须接入本项目的 Tailwind 变量、中文文案、`data-testid`、可访问名称和视觉测试要求。
- Markdown 渲染类组件优先直接复用并改造 `refer_proj/AionUi/packages/desktop/src/renderer/components/Markdown/` 的组件拆分：`Markdown/index.tsx`、`CodeBlock.tsx`、`markdownUtils.ts`。必须保留换行、列表、代码块、表格、链接、代码复制和宽表格横向滚动等富文本语义；禁止把 agent 消息作为普通纯文本 `<div>` 渲染后声称支持 Markdown。
- Agent/runtime 上游偶尔会把 Markdown 列表压成同一行；显示层可以对常见 `-` / `*` / `1.` 分点做保守换行恢复，但必须有纯函数单测并保护代码块内容。不要把普通 `+` 号当列表 marker，否则会误伤 `pg + drizzle`、`输入框 + 按钮` 等业务文本。
- 流式 Agent 回复不能直接按上游 SSE/CLI chunk 粒度刷新可见文本。UI 层必须有平滑显示缓冲、空内容时的“思考中”状态和稳定的 streaming/completed 标记；否则 CLI 偶发大块输出会表现为一卡一卡地跳字。Markdown 自定义 components 必须 memoize，避免流式更新时反复卸载代码块、表格和复制按钮。
- 可直接复用依赖组合、组件拆分、队列/lease 算法和边界处理；样式、类型、产品状态、权限语义和持久化模型必须按 AgentHub 当前 PRD/spec 调整。

**Example**:

```tsx
// Good: copy the reference renderer shape, but bind to AgentHub props and styling.
type MessageMarkdownProps = {
  content: string
  role: 'user' | 'agent' | 'orchestrator'
}

export function MessageMarkdown({ content, role }: MessageMarkdownProps) {
  return (
    <div data-testid={`message-markdown-${role}`} className="prose prose-sm max-w-none text-foreground">
      {/* Use the chosen markdown renderer stack here; component API remains AgentHub-owned. */}
      <MarkdownRenderer source={content} />
    </div>
  )
}
```

```tsx
// Bad: reference project store/model leaks into AgentHub UI.
export function MessageMarkdown({ externalConversationNode }: ReferenceProjectMessageProps) {
  return <div>{externalConversationNode.rawText}</div>
}
```

**Related**: `research/modules/im-foundation.md` requires Markdown rendering and code-block copy as P0 chat capability.

---

## 组件结构

组件文件应保持职责单一：

- 展示组件只接收 typed props，不直接读取跨层全局数据。
- 容器组件负责数据读取、状态派发和页面级编排。
- 富内容组件必须显式处理 loading、empty、error、success 状态。
- 关键 UI 容器必须提供稳定定位点，供 Playwright 使用。

推荐定位点：

- `data-testid="workspace-shell"`
- `data-testid="session-sidebar"`
- `data-testid="chat-panel"`
- `data-testid="message-composer"`
- `data-testid="artifact-panel"`
- `data-testid="authorization-card"`
- `data-testid="desktop-main-shell"`
- `data-testid="runtime-status-card"`
- `data-testid="mobile-session"`

---

## Props 约定

- props 使用 TypeScript 明确类型，禁止把跨层领域对象直接传到深层组件后随意读取。
- 状态类 props 使用有限枚举，例如 `pending | running | succeeded | failed`。
- 组件需要触发动作时，使用语义回调名，例如 `onAuthorize`、`onCancel`、`onRetry`、`onOpenPreview`。
- 文案由上层传入时也必须是中文；组件内部默认文案同样使用中文。
- Runtime 名称只作为配置或诊断摘要出现，不作为聊天对象或主要行动对象。

示例：

```tsx
type RuntimeStatus = 'ready' | 'not_installed' | 'auth_required' | 'error'

type RuntimeStatusCardProps = {
  runtimeName: 'Claude Code' | 'Codex'
  status: RuntimeStatus
  version?: string
  onDetectAgain: () => void
}
```

---

## 样式模式

- 使用 Tailwind CSS 4 和语义变量，例如 `bg-card`、`text-muted-foreground`、`border`。
- 使用 `cn()` 或等价工具组合 class，避免字符串拼接失控。
- 动态样式只用于少量尺寸、位置或颜色变量，禁止用大段 `style={{ ... }}` 复刻 CSS。
- 卡片默认圆角不超过 8px；页面 section 不做装饰性浮卡。
- 工具按钮优先使用 lucide 图标，并提供中文 `aria-label` 或 tooltip。

错误：

```tsx
<button style={{ padding: 12, borderRadius: 999, background: 'linear-gradient(...)' }}>
  Send
</button>
```

正确：

```tsx
<button className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm text-primary-foreground">
  发送
</button>
```

---

## 可访问性

- 交互按钮必须有可访问名称。
- Dialog、Dropdown、Tabs、Tooltip 优先使用成熟组件模式，避免手写不可访问浮层。
- 授权、失败、高风险动作必须有清晰文本说明，不能只依赖颜色。
- 错误信息必须能被屏幕阅读器感知；表单错误应绑定到输入控件。
- 移动端触控目标不小于 40px。

---

## 核心组件清单

P0 UI 任务优先围绕以下组件复用或抽取：

| 组件 | 所属端 | 绑定需求 |
| --- | --- | --- |
| `WorkspaceShell` | Web/Mobile | `FR-WEB-001`, `FR-MOB-001`, `FR-UI-001` |
| `ChatPanel` | Web/Mobile | `FR-CHAT-001`, `FR-UI-001` |
| `MessageComposer` | Web/Mobile | `FR-CHAT-001`, `FR-UI-001` |
| `OrchestratorPlanCard` | Web/Mobile | `FR-ORCH-001`, `FR-PERM-001` |
| `TaskResultCard` | Web/Mobile | `FR-RESULT-001`, `FR-ARTIFACT-001` |
| `AuthorizationCard` | Web/Mobile | `FR-PERM-001`, `FR-NOTIFY-001` |
| `DesktopPolicyPanel` | Desktop | `FR-PERM-001`, `FR-DESK-001` |
| `RuntimeStatusCard` | Web/Desktop | `FR-RUNTIME-001`, `FR-DESK-001` |
| `DesktopMainShell` | Desktop | `FR-DESK-001`, `FR-UI-001` |
| `ArtifactPanel` | Web/Mobile | `FR-ARTIFACT-001`, `FR-RESULT-001` |

---

## 常见错误

### 错误：本地 Runtime 组件里放 API Key 表单

修正：本地 Claude Code / Codex 只展示检测和本机登录引导。平台托管模型 Provider 凭证属于未来独立能力，不能混入本地 CLI 绑定 UI。

### 错误：页面能跑但没有视觉契约

修正：UI 任务必须引用 `FR-UI-001`，并提前写 Playwright 截图、布局和文本溢出断言。

### 错误：复制参考项目但带入错误产品模型

修正：AionUi/codeg/lobehub/cherry-studio 只作为布局、密度和组件行为参考。AgentHub 的执行域、Runtime 凭证边界和三端职责以 PRD 为准。
