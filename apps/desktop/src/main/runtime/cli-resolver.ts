import { execFile } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { homedir } from 'os'
import path from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const DEFAULT_TIMEOUT_MS = 5000

export function resolveShell() {
  return process.env.SHELL?.startsWith('/') ? process.env.SHELL : '/bin/zsh'
}

export function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function withCliPathEnv(cliPath: string, command: string) {
  const binDir = path.dirname(cliPath)
  return `PATH=${shellQuote(binDir)}:$PATH ${command}`
}

export async function runShell(command: string, options: { interactive?: boolean; timeout?: number } = {}) {
  const { stdout } = await execFileAsync(resolveShell(), [options.interactive ? '-lic' : '-lc', command], {
    timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  })
  return stdout.trim()
}

export async function runShellWithExit(command: string, options: { interactive?: boolean; timeout?: number } = {}) {
  try {
    const stdout = await runShell(command, options)
    return { stdout, exitCode: 0 }
  } catch (error) {
    const err = error as { stdout?: string; code?: number | string }
    return {
      stdout: (err.stdout ?? '').trim(),
      exitCode: typeof err.code === 'number' ? err.code : 1,
    }
  }
}

function safeReadDirs(dir: string) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => item.name)
  } catch {
    return []
  }
}

export function getCommonCliCandidates(binary: string) {
  const home = homedir()
  const candidates = [
    path.join(home, '.local/bin', binary),
    path.join(home, '.bun/bin', binary),
    path.join(home, '.asdf/shims', binary),
    path.join('/opt/homebrew/bin', binary),
    path.join('/usr/local/bin', binary),
    path.join('/usr/bin', binary),
  ]

  const nvmRoot = process.env.NVM_DIR || path.join(home, '.nvm')
  const nvmVersionsDir = path.join(nvmRoot, 'versions/node')
  for (const version of safeReadDirs(nvmVersionsDir).sort().reverse()) {
    candidates.push(path.join(nvmVersionsDir, version, 'bin', binary))
  }

  const fnmVersionsDir = path.join(home, '.fnm/node-versions')
  for (const version of safeReadDirs(fnmVersionsDir).sort().reverse()) {
    candidates.push(path.join(fnmVersionsDir, version, 'installation/bin', binary))
  }

  return [...new Set(candidates)]
}

export async function resolveCliPath(binary: string) {
  const command = `command -v ${binary} || true`
  for (const interactive of [false, true]) {
    try {
      const resolved = await runShell(command, { interactive })
      if (resolved) return resolved.split('\n')[0] || null
    } catch {
      // Continue to known installation paths.
    }
  }

  return getCommonCliCandidates(binary).find((candidate) => existsSync(candidate)) ?? null
}
