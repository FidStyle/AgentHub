# AUTH-MIG-001 Wave 1 执行报告

**日期：** 2026-05-27  
**Session：** ralph-20260527-100000  
**Wave：** 1 / 3

---

## 完成任务

### TASK-001: 修订 PRD + 技术设计 + 模块研究文档

- `research/prd.md` FR-AUTH-001 已包含 Auth.js v5 约束和本地零依赖要求
- `research/technical-design.md` §2 Auth 行、§17.1、§20 已更新为 Auth.js v5
- `research/modules/auth-workspace.md` §2 推荐、§5 推荐路线、§6 确认项已更新

**收敛验证：**
- `grep -q 'Auth.js' research/technical-design.md` ✅
- `grep -q '不依赖外部 Auth 服务' research/prd.md` ✅
- `grep -q 'Auth.js' research/modules/auth-workspace.md` ✅

### TASK-002: 安装 Auth.js v5 + Drizzle adapter + 配置基础设施

- 安装依赖：`next-auth@beta`, `@auth/drizzle-adapter`, `drizzle-orm`, `@neondatabase/serverless`, `pg`
- 创建 `apps/web/auth.ts`（Auth.js 配置 + GitHub Provider + Drizzle adapter）
- 创建 `apps/web/app/api/auth/[...nextauth]/route.ts`
- 创建 `apps/web/lib/db.ts`（Drizzle client）
- 创建 `apps/web/lib/schema/auth.ts`（users, accounts, sessions, verificationTokens）
- 更新 `.env.local.example` 添加 AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, DATABASE_URL
- 修复 tsconfig.json 继承的 `declaration: true` 导致 TS2742 问题

**收敛验证：**
- `test -f apps/web/auth.ts` ✅
- `test -f apps/web/app/api/auth/[...nextauth]/route.ts` ✅
- `test -f apps/web/lib/db.ts` ✅
- `grep -q 'next-auth' apps/web/package.json` ✅
- `pnpm type-check` ✅

---

## 下一步

Wave 2：TASK-003 middleware 统一 + TASK-004 API route auth guard + TASK-005 Login/Logout UI
