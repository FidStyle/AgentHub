# TASK-004: Role Agent CRUD API + DetailPanel Agent 配置表单

## Changes
- `apps/web/app/api/role-agents/route.ts`: 新建 GET/POST handlers（遵循 sessions API 的 auth + workspace ownership 模式）
- `apps/web/app/api/role-agents/[id]/route.ts`: 新建 GET/PATCH/DELETE handlers（含 authAndOwn helper）
- `apps/web/components/layout/DetailPanel.tsx`: 重写为 Agent 配置表单（列表 + 创建 + 编辑 + 删除）
- `apps/web/app/(workspace)/workspace/[id]/page.tsx`: DetailPanel 组件传入 `workspaceId` prop

## Verification
- [x] `export.*function.*GET` found in role-agents/route.ts (line 5)
- [x] `export.*function.*POST` found in role-agents/route.ts (line 33)
- [x] `export.*function.*PATCH` found in role-agents/[id]/route.ts (line 51)
- [x] `export.*function.*DELETE` found in role-agents/[id]/route.ts (line 85)
- [x] Agent 配置/列表/新建/编辑/保存/删除 found in DetailPanel.tsx
- [x] File: apps/web/app/api/role-agents/route.ts exists
- [x] File: apps/web/app/api/role-agents/[id]/route.ts exists
- [x] `pnpm tsc --noEmit` in web app passes (no type errors)

## Tests
- [x] `pnpm tsc --noEmit -p apps/web/tsconfig.json`: pass (no output = no errors)

## Deviations
- None

## Notes
- API 使用 `async/await params` 解构（Next.js 15 兼容），其他 API 使用 `Request` 而非 `NextRequest` 以保持一致性
- DetailPanel 角色类型选项映射 DB schema 的 `role_type: string`，包含 orchestrator/engineer/reviewer/tester/custom/general
- DetailPanel 中不需要 supabase-browser import（直接通过 API 调用，不直接访问 Supabase）
