# P0 smoke 使用真实 GitHub 关联测试用户

## Goal

修正 P0 本地 DB seed/smoke 流程：默认测试认证使用数据库里已经存在、并且通过 Auth.js `account(provider='github')` 关联过的测试用户；P0 自动化可显式创建一个真实 DB 用户，并写入测试用 GitHub account 关联来模拟绑定。

## What I Already Know

- 用户最初要求“走一个真实的数据库里有的测试用户，通过 GitHub 链接的测试用户”。
- 用户随后确认：可以创建一个真实 DB 用户，用户本身没有真实 GitHub OAuth 绑定，但测试中写入 `account(provider='github')` 来模拟绑定。
- 当前 `apps/web/scripts/setup-p0-test-db.ts` 会默认 upsert 固定 `TEST_USER_ID`、`TEST_USER_EMAIL` 和 `TEST_GITHUB_ACCOUNT_ID`，然后创建 Auth.js database session。
- `verify-p0-api-crud.ts` 已经走真实 API 和真实 Auth.js session cookie，不绕过 `auth()`。
- P0 数据原则要求 Workspace、Session、Message、User、Account 等主链路数据使用真实数据库。

## Requirements

- `pnpm env:p0:seed` 默认只从现有数据库查找 GitHub 关联测试用户。
- 查找依据优先级：
  1. `TEST_GITHUB_ACCOUNT_ID` 指定的 `account(provider='github', providerAccountId=...)`。
  2. `TEST_USER_EMAIL` 指定的用户邮箱，且该用户必须存在 GitHub account 关联。
  3. 任意一个已有 `account.provider='github'` 的用户。
- 找不到现有 GitHub 关联用户时，脚本必须失败并给出明确指引。
- 只有显式设置 `P0_CREATE_GITHUB_FIXTURE=true` 或运行 `pnpm env:p0:seed:fixture` 时，才允许创建本地 fixture 用户和测试 GitHub account，用于 P0 自动化。
- E2E global setup 应使用 fixture 入口，保证空库可自举。
- `.p0-test.env` 必须记录实际选中的 `TEST_USER_ID`、`TEST_USER_EMAIL`、`TEST_GITHUB_ACCOUNT_ID` 和 Auth.js session cookie。
- 文档必须说明默认真实用户模式和显式 fixture bootstrap 模式的区别。

## Acceptance Criteria

- [ ] 空库运行 `pnpm env:p0:seed` 会失败，并提示设置真实 GitHub 测试用户或显式 fixture bootstrap。
- [ ] 启用 `P0_CREATE_GITHUB_FIXTURE=true pnpm env:p0:seed` 或 `pnpm env:p0:seed:fixture` 可创建 bootstrap fixture。
- [ ] E2E global setup 使用 fixture seed，不依赖人工先登录 GitHub。
- [ ] 已存在 GitHub account 用户后，再次运行 `pnpm env:p0:seed` 不创建/覆盖用户和 account，只创建/更新 session。
- [ ] `pnpm env:p0:smoke` 使用该 session cookie 通过真实 API CRUD。
- [ ] `pnpm --filter @agenthub/web type-check` 和 `pnpm --filter @agenthub/web build` 通过。

## Out of Scope

- 不实现真实 GitHub OAuth 浏览器自动化登录。
- 不修改 Auth.js provider 配置。
- 不改变业务 API 权限模型。

## Technical Notes

- 相关文件：
  - `apps/web/scripts/setup-p0-test-db.ts`
  - `apps/web/scripts/verify-p0-api-crud.ts`
  - `docker/README.md`
  - `package.json`
- 共享产品原则来源：
  - `research/workflow/ai-workflow-control.md`
  - `research/contracts/P0-END-TO-END-PRODUCT-FLOW.md`
