# 前端开发规范

> AgentHub Web、Desktop、Mobile/PWA 前端实现必须遵守的项目规范。

---

## 概览

本目录包含前端开发规范。涉及 UI 的任务必须先读取 `research/product/ui-design-system.md` 和本目录中的样式、组件、质量规范。

---

## 规范索引

| 规范 | 说明 | 状态 |
|-------|-------------|--------|
| [目录结构](./directory-structure.md) | 模块组织和文件布局 | 待补齐 |
| [组件规范](./component-guidelines.md) | 组件模式、props、组合方式 | 已补 UI 基线 |
| [UI 样式与视觉测试规范](./ui-style-guidelines.md) | 三端设计系统、禁止项、视觉 E2E 门禁 | 已生效 |
| [Hook 规范](./hook-guidelines.md) | 自定义 Hook、数据获取模式 | 待补齐 |
| [状态管理](./state-management.md) | 本地状态、全局状态、服务端状态 | 待补齐 |
| [质量规范](./quality-guidelines.md) | 代码标准、禁止模式、测试要求 | 已补关键规则 |
| [类型安全](./type-safety.md) | 类型模式、校验方式 | 待补齐 |

---

## 使用规则

- 实现任何 UI 前，必须确认任务引用了 PRD 中的业务 `FR-ID`；涉及界面交付时还必须引用 `FR-UI-001`。
- Web、Desktop、Mobile/PWA 的用户可见文案必须使用简体中文。
- P0 UI 组件基线为 `shadcn/ui + Tailwind CSS 4 + lucide-react`。
- 视觉质量属于验收门禁，Playwright E2E 必须包含截图和布局断言。
- 本地 Claude Code / Codex Runtime 只做检测、绑定、诊断和本机修复引导，不在 UI 中托管 API Key。

---

**语言要求**：本项目生成的规范、任务文档、注释和用户可见文案必须使用中文；技术产品名、库名、命令名可保留英文。
