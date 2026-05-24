# Context: M5 Phase 1 — Auth + DB Schema + Workspace API

## Locked Decisions

### D1: DB Schema 位置 = supabase/migrations/
SQL migration 文件，Supabase CLI 标准做法。

### D2: API 路由 = Next.js App Router API routes
保持已有架构一致性。

### D3: M5 核心表 = profiles + workspaces + sessions + messages + role_agents
其余表在后续 milestone 按需添加。

### D4: 执行域不可变
Workspace 创建后 execution_domain 字段禁止更新（RLS + 应用层双重保障）。

## Free Decisions

### Supabase 本地开发
可选 supabase start (Docker) 或直接连远程项目。

### Session 路由模式
默认 orchestrated，可在 plan 阶段细化。

## Deferred

### 设备绑定表 (devices)
M7 Desktop Connector 阶段添加。

### Orchestrator 相关表
M8 阶段添加。
