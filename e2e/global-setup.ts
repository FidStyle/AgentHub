import { FullConfig } from '@playwright/test'
import { startMockSupabase } from './mock-supabase'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

let mockServer: ReturnType<typeof import('http').createServer> | null = null
let webProcess: ChildProcess | null = null

const MOCK_SUPABASE_PORT = 54321
const WEB_PORT = 3000

function waitForServer(url: string, timeout = 20000): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const check = () => {
      fetch(url).then((r) => {
        if (r.ok || r.status < 500) resolve()
        else if (Date.now() - start > timeout) reject(new Error(`Timeout waiting for ${url}`))
        else setTimeout(check, 500)
      }).catch(() => {
        if (Date.now() - start > timeout) reject(new Error(`Timeout waiting for ${url}`))
        else setTimeout(check, 500)
      })
    }
    check()
  })
}

async function globalSetup(_config: FullConfig) {
  // 1. Start mock Supabase
  mockServer = await startMockSupabase(MOCK_SUPABASE_PORT)

  // 2. Start web dev server with mock Supabase env
  const rootDir = path.resolve(__dirname, '..')
  webProcess = spawn('pnpm', ['dev:web'], {
    cwd: rootDir,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${MOCK_SUPABASE_PORT}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key',
      PORT: String(WEB_PORT),
    },
    stdio: 'pipe',
  })

  webProcess.stdout?.on('data', (d) => process.stdout.write(d))
  webProcess.stderr?.on('data', (d) => process.stderr.write(d))

  // 3. Wait for web server
  await waitForServer(`http://localhost:${WEB_PORT}`)

  // Store for teardown
  ;(globalThis as any).__E2E_MOCK_SERVER = mockServer
  ;(globalThis as any).__E2E_WEB_PROCESS = webProcess
}

export default globalSetup
