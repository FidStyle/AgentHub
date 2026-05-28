# P0 端到端主链路 — 真实 DB/Auth Smoke 验证报告

> 日期：2026-05-29
> 验证者：maestro-verify
> 环境：Docker Postgres + Auth.js Database Session + Next.js production build

---

## 1. DB 容器状态

```
$ docker ps --filter name=agenthub_p0_postgres --format '{{.Names}} {{.Status}} {{.Ports}}'
agenthub_p0_postgres Up 2 hours (healthy) 0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp
```

**结论**：容器运行正常，health check 通过。

---

## 2. Seed 用户/Account/Session 查询

### public."user"

| id | name | email |
|----|------|-------|
| 00000000-0000-4000-8000-000000000001 | P0 测试用户 | p0-test@agenthub.local |

### public.account

| userId | provider | providerAccountId |
|--------|----------|-------------------|
| 00000000-0000-4000-8000-000000000001 | github | agenthub-p0-test-github |

### public.session

共 8 条有效 session，均绑定到测试用户，最远过期 2026-06-27。当前使用 token: `a17027d2-77b4-4267-983b-694e94d84e18`。

**结论**：Auth.js database session 机制完整，用户/account/session 三表关联正确。

---

## 3. API Smoke PASS Summary

```
$ set -a; . docker/.p0-test.env; set +a; BASE_URL=http://localhost:3002 pnpm --filter @agenthub/web exec tsx scripts/verify-p0-api-crud.ts

=== P0 API CRUD Smoke 验证 ===
[1/5] POST /api/workspaces  ✓
[2/5] POST /api/sessions    ✓
[3/5] POST /api/messages    ✓
[4/5] GET /api/sessions     ✓ (持久化验证)
[5/5] GET /api/messages     ✓ (持久化验证)

SUMMARY: status=PASS
```

**结论**：5/5 API CRUD 端点全部通过，数据真实写入 Postgres 并可读回。

---

## 4. Build / Type-check 结果

| 命令 | 结果 |
|------|------|
| `pnpm --filter @agenthub/web type-check` | ✅ exit 0，无错误 |
| `pnpm --filter @agenthub/web build` | ✅ exit 0，production build 成功 |

---

## 5. Supabase 残留扫描

```
$ rg -n "supabase|Supabase|@supabase|NEXT_PUBLIC_SUPABASE|SUPABASE_|auth\.uid()|supabase_realtime|@db/db-js" --glob '!node_modules/**' --glob '!refer_proj/**' --glob '!refer_e2e_proj/**' --glob '!.git/**' --glob '!.next/**'

PilotDeck/src/tool/builtin/web/preapprovedHosts.ts:174:  { host: "supabase.com", allowSubdomains: false, pathPrefix: "/docs" },
```

**结论**：主项目代码零 Supabase 残留。唯一命中在 `PilotDeck/`（未跟踪的外部项目，仅为 docs URL 白名单）。

---

## 6. 剩余风险

| 风险项 | 说明 | 严重度 |
|--------|------|--------|
| Desktop 登录身份回调 | login-intent 机制已实现但未在真实 Electron 环境验证 | Medium |
| Mobile PWA 鉴权 | /m/* 路由鉴权已实现但未在真实移动设备验证 | Medium |
| /api/chat Runtime | 已重写为真实 Agent Runtime 调用，但 Runtime 服务未部署 | High |
| 三端 E2E | Playwright E2E 脚本已编写但需真实浏览器运行 | Medium |
| 完整 CRUD 清理 | smoke 测试创建的 workspace/session/message 未自动清理 | Low |

---

## 7. 结论

### ✅ 已通过

- Docker Postgres 容器 healthy
- Auth.js database session 机制完整（user/account/session 三表）
- API CRUD smoke 5/5 PASS（真实 DB 读写）
- TypeScript type-check 通过
- Production build 成功
- Supabase 运行时代码完全移除

### ⏳ 未最终完成

- Desktop Electron 真实登录流程
- Mobile 真实设备鉴权
- Agent Runtime 服务部署与 /api/chat 端到端
- 三端 Playwright E2E 真实运行
