import { stopMockSupabase } from './mock-supabase'
import { ChildProcess } from 'child_process'

async function globalTeardown() {
  const mockServer = (globalThis as any).__E2E_MOCK_SERVER
  const webProcess: ChildProcess | null = (globalThis as any).__E2E_WEB_PROCESS

  if (webProcess && !webProcess.killed) {
    webProcess.kill('SIGTERM')
  }

  if (mockServer) {
    await stopMockSupabase(mockServer)
  }
}

export default globalTeardown
