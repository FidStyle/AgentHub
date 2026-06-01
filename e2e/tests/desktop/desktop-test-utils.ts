import { spawn, type ChildProcess } from 'child_process'

export function startDesktopVite(desktopRoot: string, port: string, env: Record<string, string> = {}) {
  return spawn('npx', ['vite', '--host', '127.0.0.1', '--port', port, '--strictPort'], {
    cwd: desktopRoot,
    detached: process.platform !== 'win32',
    env: { ...process.env, ...env },
    stdio: 'pipe',
  })
}

export function waitForViteReady(viteProcess: ChildProcess) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Vite startup timeout')), 15000)
    const onData = (data: Buffer) => {
      const text = data.toString()
      if (text.includes('ready') || text.includes('Local')) {
        clearTimeout(timeout)
        resolve()
      }
    }
    viteProcess.stdout?.on('data', onData)
    viteProcess.stderr?.on('data', onData)
    viteProcess.once('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`Vite exited before ready: ${code}`))
    })
  })
}

export async function stopProcessTree(child?: ChildProcess) {
  if (!child?.pid) return
  const pid = child.pid
  const exited = new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve()
      return
    }
    child.once('exit', () => resolve())
  })

  try {
    if (process.platform === 'win32') child.kill('SIGTERM')
    else process.kill(-pid, 'SIGTERM')
  } catch {
    child.kill('SIGTERM')
  }

  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 1000))])
  if (child.exitCode !== null || child.signalCode !== null) return

  try {
    if (process.platform === 'win32') child.kill('SIGKILL')
    else process.kill(-pid, 'SIGKILL')
  } catch {
    child.kill('SIGKILL')
  }
}
