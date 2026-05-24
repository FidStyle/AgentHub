import { app, ipcMain } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'

const execAsync = promisify(exec)

export interface SingleRuntimeConfig {
  enabled: boolean
  authMode: string
  env: Record<string, string>
  nativeConfig: Record<string, unknown>
}

export interface AllRuntimeConfig {
  claude_code: SingleRuntimeConfig
  codex: SingleRuntimeConfig
}

const DEFAULT_CONFIG: AllRuntimeConfig = {
  claude_code: { enabled: true, authMode: 'official', env: {}, nativeConfig: {} },
  codex: { enabled: true, authMode: 'default', env: {}, nativeConfig: {} },
}

export class RuntimeConfigStore {
  private configPath: string
  private config: AllRuntimeConfig

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'runtime-config.json')
    this.config = this.load()
    this.registerIPC()
  }

  private load(): AllRuntimeConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8')
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
      }
    } catch { /* use default */ }
    return { ...DEFAULT_CONFIG }
  }

  private save() {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2))
  }

  getConfig(): AllRuntimeConfig {
    return this.config
  }

  getEnvForRuntime(type: 'claude_code' | 'codex'): Record<string, string> {
    return this.config[type]?.env ?? {}
  }

  private registerIPC() {
    ipcMain.handle('runtime-config:get', () => this.config)

    ipcMain.handle('runtime-config:save', (_e, type: string, cfg: SingleRuntimeConfig) => {
      if (type === 'claude_code' || type === 'codex') {
        this.config[type] = cfg
        this.save()
      }
      return true
    })

    ipcMain.handle('runtime-config:test', async (_e, type: string) => {
      const cmd = type === 'claude_code' ? 'claude --version' : 'codex --version'
      const env = { ...process.env, ...this.getEnvForRuntime(type as any) }
      try {
        const { stdout } = await execAsync(cmd, { timeout: 10000, env })
        return { ok: true, version: stdout.trim() }
      } catch (err: any) {
        return { ok: false, error: err.message }
      }
    })
  }
}
