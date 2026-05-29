# LobeHub Agent 图标替换

## 目标

将 AgentHub 中 Claude、Codex、OpenCode 对应的 SVG 图标替换为 LobeHub Icons 提供的官方图形，让 Desktop Agent 配置和 Runtime 状态展示使用更准确的品牌图标。

## 已知事实

* 用户指定参考页：`https://lobehub.com/icons/claude`、`https://lobehub.com/icons/codex`、`https://lobehub.com/icons/opencode`。
* 当前图标集中定义在 `packages/ui/src/components/brand-icon.tsx`，`packages/ui/src/components/runtime-icon.tsx` 负责 Runtime 到品牌图标的映射。
* 当前 `opencode` 被临时映射为 `agenthub`，需要改为独立 OpenCode 图标。
* `@lobehub/icons` 最新包会引入较重依赖和 React 19 peer 要求，不适合当前轻量 UI 包；采用 LobeHub 源仓库中的 SVG path 更稳。

## 需求

* `BrandIcon` 支持 `opencode` 品牌类型。
* `claude-code`、`codex`、`opencode` 使用 LobeHub Icons 的对应 SVG 图形。
* 保持现有 `BrandIcon` / `RuntimeIcon` 对外 API、尺寸枚举、`currentColor` 主题跟随能力不变。
* 不新增运行时依赖。

## 验收标准

* [ ] `RuntimeIcon` 渲染 `claude_code`、`codex`、`opencode` 时分别出现对应品牌图形。
* [ ] `opencode` 不再复用 AgentHub 图标。
* [ ] TypeScript 类型检查通过。
* [ ] 相关 Desktop E2E 对 `data-runtime` 和文案的断言不受影响。

## 范围外

* 不调整 Runtime 检测、登录、会话进入逻辑。
* 不引入 `@lobehub/icons` 包。
* 不改视觉布局和品牌色系统。

## 技术记录

* LobeHub 源路径：
  * `src/Claude/components/Mono.tsx`
  * `src/Codex/components/Mono.tsx`
  * `src/OpenCode/components/Mono.tsx`
* 选择 Mono SVG 的原因：当前共享组件以 `fill="currentColor"` 输出，Mono 版本可以无缝复用现有主题色和尺寸控制。
