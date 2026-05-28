import { ChildProcess } from 'child_process'

async function globalTeardown() {
  const webProcess: ChildProcess | null = (globalThis as any).__E2E_WEB_PROCESS

  if (webProcess && !webProcess.killed) {
    webProcess.kill('SIGTERM')
  }
}

export default globalTeardown
