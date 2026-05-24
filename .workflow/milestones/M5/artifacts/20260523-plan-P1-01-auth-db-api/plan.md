# Plan: M5 Phase 1 — Auth + DB Schema + Workspace API

## Context
- **Milestone**: M5 Auth + DB + API 基础层
- **Phase**: 1 — Auth + DB Schema + Workspace API
- **FR-IDs**: FR-AUTH-001, FR-WS-001, FR-PERM-001(基础)
- **Analysis**: ANL-006 (scratch/20260523-analyze-P1-01-auth-db-api)

## Locked Decisions
- DB Schema: `supabase/migrations/` SQL migration 文件
- API: Next.js App Router API routes
- 核心表: profiles + workspaces + sessions + messages + role_agents
- 执行域: 创建后不可变
- UI: 全局中文

## Tasks

### Task 1: Supabase 项目初始化 + DB Schema
**FR-ID**: FR-AUTH-001, FR-WS-001
**Files to create**:
- `supabase/config.toml` — Supabase 本地配置
- `supabase/migrations/00001_initial_schema.sql` — 核心表 + RLS

**Schema**:
```sql
-- profiles (extends auth.users)
profiles: id (uuid, ref auth.users), github_username, avatar_url, display_name, created_at, updated_at

-- workspaces
workspaces: id, owner_id (ref profiles), name, execution_domain ('cloud'|'local_desktop'), description, created_at, updated_at

-- sessions
sessions: id, workspace_id (ref workspaces), name, status ('active'|'archived'), routing_mode ('orchestrated'|'direct'), created_at, updated_at

-- messages
messages: id, session_id (ref sessions), sender_type ('user'|'agent'|'system'), sender_id, role_agent_id, content, message_type ('text'|'plan_card'|'result_card'|'approval'), streaming_status ('idle'|'streaming'|'complete'), created_at, updated_at

-- role_agents
role_agents: id, workspace_id (ref workspaces), name, role_type, system_prompt, capabilities, is_orchestrator, created_at, updated_at
```

**RLS policies**:
- profiles: users can only read/update own profile
- workspaces: owner can CRUD; execution_domain immutable after insert
- sessions: workspace owner can CRUD
- messages: session participants can read; only sender can insert own messages
- role_agents: workspace owner can CRUD

**Convergence criteria**: `supabase db reset` 成功执行 + 表结构匹配 + RLS 策略生效

### Task 2: Supabase 类型生成 + Shared 类型同步
**FR-ID**: FR-WS-001
**Files to create/modify**:
- `packages/shared/src/database.types.ts` — 从 Supabase 生成的类型
- `apps/web/lib/supabase-server.ts` — 更新为 typed client
- `apps/web/lib/supabase-browser.ts` — 更新为 typed client

**Convergence criteria**: TypeScript 编译通过 + Supabase client 有类型提示

### Task 3: Workspace/Session CRUD API
**FR-ID**: FR-WS-001, FR-PERM-001
**Files to create**:
- `apps/web/app/api/workspaces/route.ts` — GET (list) + POST (create)
- `apps/web/app/api/workspaces/[id]/route.ts` — GET (detail) + PATCH
- `apps/web/app/api/sessions/route.ts` — GET (list by workspace) + POST (create)
- `apps/web/app/api/sessions/[id]/route.ts` — GET (detail) + PATCH

**Convergence criteria**: curl 测试通过 + 401 未授权 + 403 跨用户

### Task 4: 中文登录页重构
**FR-ID**: FR-AUTH-001
**Files to modify**:
- `apps/web/app/page.tsx` — 全中文登录页（标题、描述、按钮）

**Convergence criteria**: `pnpm dev:web` 启动后登录页显示全中文

### Task 5: Workspace 列表页 + 创建对话框
**FR-ID**: FR-WS-001, FR-WEB-001
**Files to create/modify**:
- `apps/web/app/(workspace)/workspace/page.tsx` — 重构为 Workspace 列表 + Session 列表
- `apps/web/components/workspace/WorkspaceList.tsx` — Workspace 列表组件
- `apps/web/components/workspace/CreateWorkspaceDialog.tsx` — 创建对话框（选执行域）
- `apps/web/components/session/SessionList.tsx` — Session 列表组件

**Convergence criteria**: 登录后看到 Workspace 列表 + 可创建 + 可点进 Session 列表

### Task 6: Profile 自动创建 + Auth Callback 完善
**FR-ID**: FR-AUTH-001
**Files to modify**:
- `apps/web/app/auth/callback/route.ts` — 登录后自动创建/更新 profile
- `supabase/migrations/00001_initial_schema.sql` — 添加 trigger: on auth.users insert → create profile

**Convergence criteria**: 新用户首次登录自动创建 profile

## Execution Order
1. Task 1 (DB Schema) → 2 (类型) → 6 (Profile trigger)
2. Task 3 (API) — 依赖 Task 1+2
3. Task 4 (登录页) — 可并行
4. Task 5 (Workspace UI) — 依赖 Task 3

## Success Criteria (Phase Exit)
1. ✅ `pnpm dev:web` 启动后浏览器可访问中文登录页
2. ✅ GitHub OAuth 登录成功后跳转中文 Workspace 列表页
3. ✅ 用户可创建 Workspace（选择执行域 cloud/local_desktop）
4. ✅ 用户可创建 Session
5. ✅ 所有数据持久化到 Supabase（非 in-memory）
6. ✅ 所有 UI 文字为简体中文
7. ✅ TypeScript 编译无错误
