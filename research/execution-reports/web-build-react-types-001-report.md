# WEB-BUILD-REACT-TYPES-001 执行报告

| 字段 | 内容 |
|------|------|
| **任务** | WEB-BUILD-REACT-TYPES-001 — 修复 `@agenthub/web` `next build` 失败的 dual `@types/react` 类型冲突 |
| **优先级** | P0 build blocker（`pnpm --filter @agenthub/web build` 直接 exit 1，发布主链路 `release:web` 不可用） |
| **日期** | 2026-05-31 |
| **关联 REG** | REG-20260531-004（build blocker，本任务关闭）；此前以 carried-over concern 形式散见于 FLOATING-UI-FIX-D1-001 / UI-TOOLTIP-POSITION-001 / WEB-WORKSPACE-LAYOUT-UAT-001 报告，本次升级为独立 build blocker 并闭环 |

## 1. 现象

`pnpm --filter @agenthub/web build`（`next build`）SWC 编译成功，但在 "Linting and checking validity of types" 阶段 exit 1：

```
./app/m/preview/page.tsx:36:6
Type error: 'Suspense' cannot be used as a JSX component.
  Its type 'ExoticComponent<SuspenseProps>' is not a valid JSX element type.
    ...
    Type '...@types+react@19.2.15/.../ReactNode' is not assignable to type 'React.ReactNode'.
        Property 'children' is missing in type 'ReactElement<...>' but required in type 'ReactPortal'.
```

`tsc --noEmit` 全量复现，同源错误覆盖：
- `app/m/preview/page.tsx` — `Suspense`
- `components/chat/ChatPanel.tsx` — `ReactMarkdown`
- `components/workspace/Sidebar.tsx` — `WorkspaceDropdown`（`createPortal`）
- `packages/ui/src/components/tooltip.tsx` — `TooltipContent`（`createPortal`）

## 2. 根因

经 `tsc --traceResolution` 坐实：编译 `@agenthub/web` 时 TypeScript 的 ambient `@types` 自动发现把 **两份** `@types/react` 同时纳入编译图：

| 来源 | 路径 | 版本 |
|------|------|------|
| web 直接依赖（正确） | `apps/web/node_modules/@types/react` | 19.2.15 |
| pnpm 虚拟仓库根（泄漏） | `node_modules/.pnpm/node_modules/@types/react` | **18.3.29** |

`react-markdown` 等 root 依赖位于 `node_modules/.pnpm/...`，TS 编译其 `.d.ts` 时沿目录上溯命中 pnpm hoist 到虚拟仓库根的裸副本；该副本被 pnpm 选成 mobile 锁定的 **18.3.29**。React 18 的 `ReactPortal.children` 为必填、React 19 的为可选，两份 `React.ReactNode` 结构不兼容，导致所有 `Suspense` / portal / `ReactMarkdown` 的 JSX 使用全部报 TS2786。

根因不是 `Suspense` 本身，也不是任何业务代码——是 monorepo 中 mobile(React 18) 与 web/ui/desktop(React 19) 的 `@types/react` 在 pnpm hoist 时污染了共享虚拟仓库根。

## 3. 修复

在根 `.npmrc` 用 `hoist-pattern` 把 `@types/react` / `@types/react-dom` 排除出 pnpm 虚拟仓库根（`node_modules/.pnpm/node_modules`），杜绝裸副本被 ambient 发现；同时清理了重复的 `strict-peer-dependencies` 行：

```ini
hoist-pattern[]=*
hoist-pattern[]=!@types/react
hoist-pattern[]=!@types/react-dom
```

各 workspace 仍通过自身 `node_modules` 内的直接依赖软链解析各自版本——mobile 隔离 18，web/ui/desktop 用 19。**未使用** `any` / 类型断言 / `skipLibCheck` / 关闭类型检查等绕过手段。

随后 `pnpm install` 重建依赖树。

## 4. 验证

| 检查 | 结果 |
|------|------|
| `pnpm --filter @agenthub/web build` | **exit 0**（含 `/m/preview` 等路由成功 prerender） |
| `pnpm --filter @agenthub/web type-check`（`tsc --noEmit`） | **exit 0** |
| `packages/ui` type-check（`tsc --noEmit`） | **exit 0** |
| `apps/desktop` type-check | **exit 0**（同 React 19，附带确认无回归） |
| 残留 `ReactNode`/`ReactPortal`/`Suspense`/`Tooltip`/`createPortal`/TS2786 错误 | **0** |
| hoist 后 `node_modules/.pnpm/node_modules/@types/react` | **已消失** |
| `pnpm -r list @types/react` | web/ui/desktop=19.2.15，mobile=18.3.29（隔离保持） |

## 5. 结论

dual `@types/react` 由 carried-over concern 升级为 build blocker（REG-20260531-004）并关闭。修复在依赖解析层根治，不触碰任何业务/UI 源码，mobile 的 React 18 类型隔离与 web/ui/desktop 的 React 19 类型同时成立。
