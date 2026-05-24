# TASK-004 Summary: Role Agent CRUD API + DetailPanel Agent 配置表单

**Task**: TASK-004 | **Wave**: wave-3 | **Status**: completed
**Executor**: workflow-executor agent | **Duration**: ~123s
**Commit**: 29ff59a

## Changes

### apps/web/app/api/role-agents/route.ts (新建)
- GET: 返回 workspace 下所有 role_agents（含 auth + workspace ownership 校验）
- POST: 创建新 Agent（含 auth + workspace ownership 校验）

### apps/web/app/api/role-agents/[id]/route.ts (新建)
- GET: 获取单个 Agent
- PATCH: 更新 Agent 字段
- DELETE: 删除 Agent

### apps/web/components/layout/DetailPanel.tsx (重写)
- Agent 列表展示（max-h-32 滚动区域）
- 新建按钮 → 创建默认 Agent
- 表单字段：名称（input）、角色类型（select）、System Prompt（textarea）、编排者（checkbox）
- 编辑/保存/取消/删除 操作
- 无 workspace 时显示友好提示

### workspace/[id]/page.tsx
- `<DetailPanel />` → `<DetailPanel workspaceId={workspaceId} />`

## Verification
- [x] GET/POST in role-agents/route.ts
- [x] GET/PATCH/DELETE in role-agents/[id]/route.ts
- [x] Agent 配置/列表/新建/编辑/保存/删除 关键词
- [x] Files exist
- [x] tsc --noEmit pass
