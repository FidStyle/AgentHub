# 执行前报告：P0 认证路线迁移 Supabase Auth → Auth.js v5

**报告类型：** 执行前（Pre-Execution）  
**日期：** 2026-05-27  
**对应跟进项：** AUTH-MIG-001  
**Plan ID：** PLN-auth-migration  
**Ralph Session：** ralph-20260527-100000

---

## 1. 执行目标

将认证层从 Supabase Auth 迁移至 Auth.js v5 + GitHub OAuth Provider，消除本地开发/E2E/Demo 对 Supabase 控制台的强依赖。DB 层暂保留 Supabase Postgres 客户端。

## 2. 前置分析结论

| 维度 | 结论 |
|------|------|
| 范围判定 | medium |
| 推荐 | Go |
| 置信度 | 85% |
| 破坏性变更 | 无 |
| 迁移复杂度 | medium |

## 3. 影响范围

### 受影响文件（19 个）

- `apps/web/middleware.ts`
- `apps/web/app/page.tsx`
- `apps/web/app/auth/callback/route.ts`
- `apps/web/lib/supabase-browser.ts`
- `apps/web/lib/supabase-server.ts`
- `apps/web/server/ws-gateway.ts`
- `apps/web/app/api/workspaces/route.ts`
- `apps/web/app/api/sessions/route.ts`
- `apps/web/app/api/messages/route.ts`
- `apps/web/app/api/role-agents/route.ts`
- `apps/web/app/api/plans/route.ts`
- `apps/web/app/api/actions/route.ts`
- `apps/web/app/api/notifications/route.ts`
- `apps/web/app/api/devices/route.ts`
- `apps/web/app/api/devices/bind/route.ts`
- `apps/web/app/api/runtime/invoke/route.ts`
- `packages/shared/src/database.types.ts`
- `research/modules/auth-workspace.md`
- `research/technical-design.md`

### 受影响子系统

- auth
- api-routes

## 4. 执行计划

### Wave 1: 文档修订 + Auth.js 基础设施

| Task | 内容 |
|------|------|
| TASK-001 | 文档修订（PRD/技术设计/模块调研 auth 章节更新为 Auth.js 路线） |
| TASK-002 | Auth.js v5 基础设施搭建（安装依赖、配置 provider、Drizzle adapter、session schema） |

### Wave 2: 认证层替换

| Task | 内容 |
|------|------|
| TASK-003 | middleware 重写（Supabase session → Auth.js session） |
| TASK-004 | API routes auth guard 批量替换 |
| TASK-005 | Login/Logout 页面和回调路由替换 |

### Wave 3: 设备绑定迁移 + 验证

| Task | 内容 |
|------|------|
| TASK-006 | Desktop 设备绑定迁移（自建 device token 替换 Supabase Auth session） |
| TASK-007 | E2E 验证（auth 测试通过 + Demo 路径不退化） |

## 5. 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| API route auth guard 替换遗漏 | TASK-004 使用统一模式批量处理，pressure_pass 已验证 |
| 设备绑定 token 安全性 | 自建 device token 使用 crypto.randomBytes + 过期机制 |
| Realtime 订阅身份验证 | DB 层保留 Supabase client，Realtime 不受影响 |

## 6. 验收标准

- [ ] `npm run dev` 无需 Supabase Auth 环境变量
- [ ] E2E auth 测试通过
- [ ] Demo 主路径不退化
- [ ] Desktop Connector 设备绑定正常

## 7. 置信度评估

| 维度 | 分数 |
|------|------|
| 可行性 | 90 |
| 完整性 | 80 |
| 风险缓解 | 75 |
| 清晰度 | 85 |
| 可测试性 | 80 |
| **综合** | **82** |

---

## 8. 执行后更新区域

> 以下区域在执行完成后填写。

### Wave 完成记录

| Wave | 状态 | 完成日期 | 备注 |
|------|------|----------|------|
| W1 | ⏳ 待执行 | — | — |
| W2 | ⏳ 待执行 | — | — |
| W3 | ⏳ 待执行 | — | — |

### 验收结果

（执行后填写）

### 偏差与教训

（执行后填写）
