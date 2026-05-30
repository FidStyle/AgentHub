import path from 'path'
import fs from 'fs'

/**
 * P0 E2E 登录策略：
 * 1. 优先使用 TEST_AUTH_STORAGE_STATE 环境变量指向的人工录制 storageState
 * 2. 否则使用 TEST_AUTH_COOKIE 构造 cookie-based storageState
 * 3. 该 fixture 只替代 OAuth 人机步骤，不 mock 任何主链路 API
 */
export async function ensureP0StorageState(): Promise<string> {
  const stateDir = path.join(__dirname, '..', '.auth')
  const statePath = path.join(stateDir, 'p0-user.json')

  if (process.env.TEST_AUTH_STORAGE_STATE) {
    const customPath = path.resolve(process.env.TEST_AUTH_STORAGE_STATE)
    if (fs.existsSync(customPath)) return customPath
    throw new Error(`TEST_AUTH_STORAGE_STATE 指向的文件不存在: ${customPath}`)
  }

  // TEST_AUTH_COOKIE_VALUE 是裸 session token；TEST_AUTH_COOKIE 是完整 `name=value` 对，
  // 取末段还原裸 token，避免把 `authjs.session-token=` 前缀写进 cookie value 导致 401。
  const cookieValue =
    process.env.TEST_AUTH_COOKIE_VALUE ??
    (process.env.TEST_AUTH_COOKIE ? process.env.TEST_AUTH_COOKIE.split('=').pop() : undefined)

  if (cookieValue) {
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true })
    const state = {
      cookies: [
        {
          name: 'authjs.session-token',
          value: cookieValue,
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
          expires: Math.floor(Date.now() / 1000) + 86400,
        },
      ],
      origins: [],
    }
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2))
    return statePath
  }

  throw new Error(
    'E2E 登录需要 TEST_AUTH_STORAGE_STATE（人工录制）或 TEST_AUTH_COOKIE（DB session token）。' +
    '不允许 mock 主链路 API。'
  )
}

export const TEST_USER_ID = process.env.TEST_USER_ID || 'e2e-test-user'
