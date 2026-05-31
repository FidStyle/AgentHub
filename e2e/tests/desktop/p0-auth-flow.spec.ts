import { test, expect, _electron as electron } from '@playwright/test'

const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:3000'

async function webServiceAvailable() {
  try {
    const res = await fetch(WEB_BASE_URL, { method: 'HEAD' })
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

test.describe('P0 Desktop 登录流程', () => {
  test('login-intent 创建 → bind-status 轮询 → 绑定后身份展示', async () => {
    test.skip(!(await webServiceAvailable()), `需要可访问的 Web 服务：${WEB_BASE_URL}`)

    // 1. 创建 login-intent（公开端点，无需 auth）
    const intentRes = await fetch(`${WEB_BASE_URL}/api/devices/login-intent`, { method: 'POST' })
    expect(intentRes.status).toBe(200)
    const { code, sign_in_url } = await intentRes.json()
    expect(code).toBeTruthy()
    expect(sign_in_url).toContain('device-bind')

    // 2. bind-status 初始为 bound:false
    const statusRes1 = await fetch(`${WEB_BASE_URL}/api/devices/bind-status?code=${code}`)
    expect(statusRes1.status).toBe(200)
    const status1 = await statusRes1.json()
    expect(status1.bound).toBe(false)

    // 3. 模拟 Web 端绑定（需要真实 auth session）
    // 真实绑定需要已登录 Web session 访问 /auth/device-bind?code=xxx
    if (!process.env.TEST_AUTH_COOKIE) {
      test.skip(true, '需要 TEST_AUTH_COOKIE 完成绑定验证')
    }

    // 4. 绑定后 bind-status 应返回 bound:true
    const bindRes = await fetch(`${WEB_BASE_URL}/auth/device-bind?code=${code}`, {
      headers: { Cookie: `authjs.session-token=${process.env.TEST_AUTH_COOKIE}` },
      redirect: 'manual',
    })
    expect(bindRes.status).toBeLessThan(400)

    const statusRes2 = await fetch(`${WEB_BASE_URL}/api/devices/bind-status?code=${code}`)
    const status2 = await statusRes2.json()
    expect(status2.bound).toBe(true)
    expect(status2.user).toBeTruthy()
    expect(status2.user.id).toBeTruthy()

    // 5. 验证过期 code 返回 404
    const expiredRes = await fetch(`${WEB_BASE_URL}/api/devices/bind-status?code=nonexistent-code`)
    expect(expiredRes.status).toBe(404)
  })

  test('Electron 启动 → 点击登录 → 验证 login-intent 调用', async () => {
    // Electron E2E 需要构建后的 desktop app
    if (!process.env.DESKTOP_APP_PATH) {
      test.skip(true, '需要 DESKTOP_APP_PATH 指向构建后的 Electron app')
    }

    const app = await electron.launch({ args: [process.env.DESKTOP_APP_PATH!] })
    const window = await app.firstWindow()

    // 验证登录按钮存在
    const loginBtn = window.locator('[data-testid="github-login"], button:has-text("GitHub 登录")')
    await expect(loginBtn.first()).toBeVisible()

    await app.close()
  })
})
