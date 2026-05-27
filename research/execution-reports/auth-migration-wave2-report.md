# AUTH-MIG-001 Wave 2 执行报告

**日期：** 2026-05-27  
**Session：** ralph-20260527-100000  
**Wave：** 2 / 3

---

## 完成任务

### TASK-003: 替换 middleware.ts 认证守卫

- 移除 Supabase auth 中间件，改用 Auth.js `auth()` wrapper
- 保护 `/workspace/:path*` 路由，未认证重定向至首页

**收敛验证：**
- `! grep -q 'supabase' apps/web/middleware.ts` ✅
- `grep -q 'auth' apps/web/middleware.ts` ✅

### TASK-004: 替换所有 API route 的 auth guard

- 创建 `apps/web/lib/auth-guard.ts`（`requireAuth()` 统一鉴权函数）
- 所有 API route 替换为 `requireAuth()` 调用
- 移除 `supabase.auth.getUser()` 依赖

**收敛验证：**
- `! grep -rq 'supabase.auth' apps/web/app/api/` ✅
- `grep -rq 'requireAuth' apps/web/app/api/workspaces/route.ts` ✅
- `test -f apps/web/lib/auth-guard.ts` ✅

### TASK-005: 替换登录页面 + 移除 Supabase Auth 依赖

- `apps/web/app/page.tsx` 改用 Auth.js `signIn('github')` Server Action
- 移除 `apps/web/lib/supabase-browser.ts`（Supabase Auth 浏览器客户端）
- 移除 `apps/web/app/auth/callback/route.ts`（Supabase OAuth callback）
- 移除 `@supabase/ssr` 依赖

**收敛验证：**
- `! test -f apps/web/lib/supabase-browser.ts` ✅
- `! test -f apps/web/app/auth/callback/route.ts` ✅
- `grep -q 'signIn' apps/web/app/page.tsx` ✅
- `! grep -q '@supabase/ssr' apps/web/package.json` ✅

---

## 下一步

Wave 3：TASK-006 Desktop 设备绑定迁移 + TASK-007 E2E 测试适配
