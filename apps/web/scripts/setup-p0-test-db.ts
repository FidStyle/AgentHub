import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'

const repoRoot = path.resolve(__dirname, '../../..')
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://agenthub:agenthub_dev@localhost:5432/agenthub_p0_test'
const testUserId = process.env.TEST_USER_ID ?? '00000000-0000-4000-8000-000000000001'
const testUserEmail = process.env.TEST_USER_EMAIL ?? 'p0-test@agenthub.local'
const testUserName = process.env.TEST_USER_NAME ?? 'P0 测试用户'
const testGithubAccountId = process.env.TEST_GITHUB_ACCOUNT_ID ?? 'agenthub-p0-test-github'
const sessionToken = process.env.TEST_AUTH_SESSION_TOKEN ?? randomUUID()
const schemaPath = path.join(repoRoot, 'docker/postgres/p0-test-schema.sql')
const envPath = process.env.P0_TEST_ENV_FILE
  ? path.resolve(process.env.P0_TEST_ENV_FILE)
  : path.join(repoRoot, 'docker/.p0-test.env')

async function main() {
  const pool = new Pool({ connectionString: databaseUrl })
  const schema = fs.readFileSync(schemaPath, 'utf8')
  await pool.query(schema)

  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

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

  await pool.query(
    `INSERT INTO public.session ("sessionToken", "userId", expires)
     VALUES ($1, $2, $3)
     ON CONFLICT ("sessionToken") DO UPDATE SET "userId" = EXCLUDED."userId", expires = EXCLUDED.expires`,
    [sessionToken, testUserId, expires],
  )

  await pool.end()

  const envContent = [
    `DATABASE_URL=${databaseUrl}`,
    'AGENTHUB_DB_CLIENT=postgres',
    'AUTH_TRUST_HOST=true',
    'AUTH_SECRET=agenthub-p0-local-test-auth-secret',
    'BASE_URL=http://localhost:3000',
    `TEST_USER_ID=${testUserId}`,
    `TEST_GITHUB_ACCOUNT_ID=${testGithubAccountId}`,
    `TEST_AUTH_SESSION_TOKEN=${sessionToken}`,
    `TEST_AUTH_COOKIE=authjs.session-token=${sessionToken}`,
    `TEST_AUTH_COOKIE_VALUE=${sessionToken}`,
    '',
  ].join('\n')

  fs.writeFileSync(envPath, envContent)

  console.log('=== P0 test database ready ===')
  console.log(`DATABASE_URL=${databaseUrl}`)
  console.log(`TEST_USER_ID=${testUserId}`)
  console.log(`TEST_GITHUB_ACCOUNT_ID=${testGithubAccountId}`)
  console.log(`TEST_AUTH_COOKIE=authjs.session-token=${sessionToken}`)
  console.log(`Wrote ${path.relative(repoRoot, envPath)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
