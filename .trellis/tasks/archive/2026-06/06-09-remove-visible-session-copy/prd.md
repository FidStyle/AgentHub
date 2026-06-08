# 移除用户可见会话文案

## Goal

在已经有“联系人 / 单聊 / 群聊”信息架构后，用户界面不再把“会话”作为重复的一等入口展示。内部 `Session` 数据模型、API 路径和测试辅助命名可以保留；用户可见的 Web/Mobile IM 入口应收敛到“聊天、联系人、群聊、单聊”。

## What I Already Know

- 用户明确反馈：现在还有“会话”对应显示；有单聊、群聊的地方，就把重复的会话入口删掉。
- Web 左侧 `Sidebar` 仍显示“会话”和“新建会话”按钮，和 `SessionList` 中“联系人和群聊 / 新建群聊”重复。
- `SessionList` 里归档、恢复、删除、空态还使用“会话”文案。
- Mobile 首页仍有“会话 / 新建会话 / 加载会话 / 暂无会话”。
- Orchestrator、Artifact 等工作台空态也有用户可见“会话”文案。

## Requirements

- Web 左侧移除重复的“会话”标题和“新建会话”按钮；不再提供空白新会话入口。
- Web 左侧保留“联系人与群聊”和“新建群聊”；点联系人进入单聊，点群聊进入群聊。
- 用户可见操作文案从“归档/恢复/删除会话”改为“归档/恢复/删除聊天”。
- 用户可见空态和搜索结果文案从“会话”改为“聊天”或“联系人/群聊”。
- Mobile/PWA 可见文案同步改为“聊天 / 新建聊天”。
- 内部 `Session` 类型、API 路径 `/api/sessions`、数据库字段、runtime native session 等技术语义不在本任务改名。

## Acceptance Criteria

- [x] Web 侧栏不再显示“会话”标题和“新建会话”按钮。
- [x] Web 侧栏仍能显示联系人与群聊，群聊创建入口保留。
- [x] Web/Mobile 用户可见 IM 文案不再把“会话”作为主入口。
- [x] 相关单测 / E2E 断言更新到新文案。
- [x] Web type-check、lint、相关测试通过。

## Out Of Scope

- 不重命名代码里的 `Session` 类型、store 方法和 API 路径。
- 不修改数据库 schema 或历史数据表名。
- 不处理 Desktop 本地 Runtime “native session / 进入会话”技术语义；那是 Runtime 原生会话，不是 Web IM 重复入口。
- 不重做联系人/群聊数据模型。

## Technical Notes

- 主要文件：
  - `apps/web/components/workspace/Sidebar.tsx`
  - `apps/web/components/workspace/SessionList.tsx`
  - `apps/web/components/workspace/ChatPanel.tsx`
  - `apps/web/components/workspace/ArtifactPanel.tsx`
  - `apps/web/components/orchestrator/OrchestratorPanel.tsx`
  - `apps/web/components/orchestrator/ActionCard.tsx`
  - `apps/web/app/m/page.tsx`
  - 相关 E2E：`session-list-density`, `web-workspace-layout-uat`, `ui-tooltip-position` 等。
