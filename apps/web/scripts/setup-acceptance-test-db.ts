import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'

type GithubTestUser = {
  user_id: string
  email: string | null
  name: string | null
  image: string | null
  github_account_id: string
}

const repoRoot = path.resolve(__dirname, '../../..')

function loadLocalEnv() {
  const envPath = path.join(repoRoot, 'apps/web/.env.local')
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const index = trimmed.indexOf('=')
    if (index === -1) continue

    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) process.env[key] = value
  }
}

loadLocalEnv()

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://agenthub:agenthub_dev@localhost:5432/agenthub_acceptance'
const shouldCreateFixture = process.env.ACCEPTANCE_CREATE_GITHUB_FIXTURE === 'true'
const fixtureUserId = '00000000-0000-4000-8000-000000000001'
const fixtureGithubAccountId = 'agenthub-acceptance-github'
const testUserId = process.env.TEST_USER_ID ?? (shouldCreateFixture ? fixtureUserId : undefined)
const testUserEmail = process.env.TEST_USER_EMAIL ?? 'acceptance-test@agenthub.local'
const testUserName = process.env.TEST_USER_NAME ?? '验收测试用户'
const testGithubAccountId =
  process.env.TEST_GITHUB_ACCOUNT_ID ?? (shouldCreateFixture ? fixtureGithubAccountId : undefined)
const sessionToken = process.env.TEST_AUTH_SESSION_TOKEN ?? randomUUID()
const schemaPath = path.join(repoRoot, 'docker/postgres/acceptance-schema.sql')
const envPath = process.env.ACCEPTANCE_ENV_FILE
  ? path.resolve(process.env.ACCEPTANCE_ENV_FILE)
  : path.join(repoRoot, 'docker/.acceptance.env')

async function findExistingGithubUser(pool: Pool): Promise<GithubTestUser | null> {
  const filters: string[] = [`a.provider = 'github'`]
  const params: string[] = []

  if (testGithubAccountId) {
    params.push(testGithubAccountId)
    filters.push(`a."providerAccountId" = $${params.length}`)
  }

  if (process.env.TEST_USER_EMAIL) {
    params.push(testUserEmail)
    filters.push(`u.email = $${params.length}`)
  }

  if (!shouldCreateFixture) {
    params.push(fixtureUserId)
    filters.push(`u.id <> $${params.length}`)
    params.push(fixtureGithubAccountId)
    filters.push(`a."providerAccountId" <> $${params.length}`)
  }

  const { rows } = await pool.query(
    `SELECT
       u.id AS user_id,
       u.email,
       u.name,
       u.image,
       a."providerAccountId" AS github_account_id
     FROM public.account a
     INNER JOIN public."user" u ON u.id = a."userId"
     WHERE ${filters.join(' AND ')}
     ORDER BY u.email NULLS LAST, u.id
     LIMIT 1`,
    params,
  )

  return (rows[0] as GithubTestUser | undefined) ?? null
}

async function createFixtureGithubUser(pool: Pool): Promise<GithubTestUser> {
  if (!testUserId || !testGithubAccountId) {
    throw new Error('ACCEPTANCE_CREATE_GITHUB_FIXTURE=true 时必须提供 TEST_USER_ID 和 TEST_GITHUB_ACCOUNT_ID。')
  }

  await pool.query(
    `INSERT INTO public."user" (id, name, email, image)
     VALUES ($1, $2, $3, NULL)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email`,
    [testUserId, testUserName, testUserEmail],
  )

  await pool.query(
    `INSERT INTO public.profiles (id, display_name)
     VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()`,
    [testUserId, testUserName],
  )

  await pool.query(
    `INSERT INTO public.account ("userId", type, provider, "providerAccountId")
     VALUES ($1, 'oauth', 'github', $2)
     ON CONFLICT (provider, "providerAccountId") DO UPDATE SET "userId" = EXCLUDED."userId"`,
    [testUserId, testGithubAccountId],
  )

  return {
    user_id: testUserId,
    email: testUserEmail,
    name: testUserName,
    image: null,
    github_account_id: testGithubAccountId,
  }
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl })
  const schema = fs.readFileSync(schemaPath, 'utf8')
  await pool.query(schema)

  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const githubUser = await findExistingGithubUser(pool) ?? (shouldCreateFixture ? await createFixtureGithubUser(pool) : null)

  if (!githubUser) {
    throw new Error(
      [
        '未找到数据库里已有的 GitHub 关联测试用户。',
        '请先用 GitHub OAuth 登录一次，或在 Auth.js 表中准备 user + account(provider=github) 记录。',
        '可选筛选：TEST_GITHUB_ACCOUNT_ID=<github providerAccountId> 或 TEST_USER_EMAIL=<email>。',
        '仅空库 bootstrap 时可显式运行：ACCEPTANCE_CREATE_GITHUB_FIXTURE=true pnpm env:acceptance:seed。',
      ].join('\n'),
    )
  }

  await pool.query(
    `INSERT INTO public.session ("sessionToken", "userId", expires)
     VALUES ($1, $2, $3)
     ON CONFLICT ("sessionToken") DO UPDATE SET "userId" = EXCLUDED."userId", expires = EXCLUDED.expires`,
    [sessionToken, githubUser.user_id, expires],
  )

  await pool.end()

  const envContent = [
    `DATABASE_URL=${databaseUrl}`,
    'AGENTHUB_DB_CLIENT=postgres',
    'AUTH_TRUST_HOST=true',
    'AUTH_SECRET=agenthub-acceptance-local-test-auth-secret',
    'BASE_URL=http://localhost:3000',
    `TEST_USER_ID=${githubUser.user_id}`,
    `TEST_USER_EMAIL=${githubUser.email ?? ''}`,
    `TEST_GITHUB_ACCOUNT_ID=${githubUser.github_account_id}`,
    `TEST_AUTH_SESSION_TOKEN=${sessionToken}`,
    `TEST_AUTH_COOKIE=authjs.session-token=${sessionToken}`,
    `TEST_AUTH_COOKIE_VALUE=${sessionToken}`,
    '',
  ].join('\n')

  fs.writeFileSync(envPath, envContent)

  console.log('=== Acceptance test database ready ===')
  console.log(`DATABASE_URL=${databaseUrl}`)
  console.log(`TEST_USER_ID=${githubUser.user_id}`)
  console.log(`TEST_USER_EMAIL=${githubUser.email ?? ''}`)
  console.log(`TEST_GITHUB_ACCOUNT_ID=${githubUser.github_account_id}`)
  console.log(`TEST_AUTH_COOKIE=authjs.session-token=${sessionToken}`)
  console.log(`Wrote ${path.relative(repoRoot, envPath)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
