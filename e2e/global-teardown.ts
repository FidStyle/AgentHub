import { ChildProcess } from 'child_process'

async function globalTeardown() {
  const webProcess: ChildProcess | null = (globalThis as any).__E2E_WEB_PROCESS
  const runtimeWorker: ChildProcess | null = (globalThis as any).__E2E_RUNTIME_WORKER

  if (runtimeWorker && !runtimeWorker.killed) {
    runtimeWorker.kill('SIGTERM')
  }
  if (webProcess && !webProcess.killed) {
    webProcess.kill('SIGTERM')
  }
}

export default globalTeardown
