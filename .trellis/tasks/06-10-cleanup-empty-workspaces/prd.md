# 清理无产物真实 Workspace

## Goal

清理 AgentHub 产品数据库中的真实 Workspace 垃圾数据，减少 Web/Desktop 产品界面里的无用或不完整工作区。清理范围以产品数据为准，不处理 `.workflow` / Trellis 执行痕迹。

## What I already know

* 用户确认要清理的是 AgentHub 产品里的真实 Workspace，不是流程文件夹。
* 当前产品 Workspace 使用 Postgres 表 `public.workspaces`，关联 `sessions`、`messages`、`role_agents`、`artifacts` 等表。
* `docker/postgres/acceptance-schema.sql` 中相关子表对 `workspaces` / `sessions` 使用 `ON DELETE CASCADE`。
* `DELETE /api/workspaces/[id]` 端点会先删除 `workspaces` 行，再删除 cloud workspace 目录。
* 当前本机默认验收库可连接，存在大量 `E2E-*`、`smoke-test-*`、`chat-test-cloud-*` 等测试 Workspace。

## Requirements

* 删除无最终产物的真实产品 Workspace：`artifacts = 0`。
* 保留已有 artifact 的 Workspace，避免误删有效交付。
* 删除数据库记录时依赖数据库外键级联清理 sessions/messages/role_agents/runtime 等关联行。
* 对 cloud workspace，同步删除 `cloud_project_dir` 指向的磁盘目录。
* 删除前生成本地 JSON 备份，至少包含被删 Workspace、计数、路径和关联 session/artifact 信息。
* 删除只针对当前默认本地验收数据库，不修改生产或远端数据库。

## Acceptance Criteria

* [ ] 删除前有候选清单和备份文件。
* [ ] 数据库中 `artifacts = 0` 的 workspace 数量变为 0。
* [ ] 有 artifact 的 workspace 仍保留。
* [ ] 被删 cloud workspace 目录不存在。
* [ ] 清理结果输出删除数量、保留数量、失败项。

## Out of Scope

* 不清理 `.workflow/scratch`、`.workflow/.maestro`、`.trellis/tasks`。
* 不删除有 artifact 的 Workspace。
* 不重置整个数据库。
* 不修改产品代码。

## Technical Notes

* 默认数据库连接：`process.env.DATABASE_URL || postgresql://agenthub:agenthub_dev@localhost:5432/agenthub_acceptance`。
* Cloud workspace root 默认：`~/.agenthub/cloud-workspaces`。
* 删除目录必须限制在 cloud workspace root 下，避免误删任意路径。
