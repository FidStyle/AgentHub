import { ipcMain } from 'electron'
import type { RuntimeEvent, RequestFrame } from '@agenthub/shared'
import { StreamAdapter } from './stream-adapter'
import { LocalRuntimeAdapter, type RuntimePromptRequest } from './local-adapter'
import { RuntimeDetector, type RuntimeInfo } from './runtime-detector'
import { RuntimeConfigStore } from './runtime-config-store'
import type { DeviceChannel } from '../device-channel'

export class RuntimeHost {
  private detector = new RuntimeDetector()
  private activeSessions = new Map<string, StreamAdapter>()
  private channel: DeviceChannel | null = null
  private cachedRuntimes: RuntimeInfo[] = []
  private configStore: RuntimeConfigStore | null = null

  constructor() {
    this.registerIPC()
  }

  setChannel(channel: DeviceChannel) {
    this.channel = channel
    channel.onRequest('runtime_invoke', (frame) => this.handleInvoke(frame))
    channel.onRequest('runtime_cancel', (frame) => this.handleCancel(frame))
    channel.onRequest('detect_runtime', (frame) => this.handleDetect(frame))
  }

  setConfigStore(store: RuntimeConfigStore) {
    this.configStore = store
  }

  private registerIPC() {
    ipcMain.handle('runtime:detect', async () => {
      this.cachedRuntimes = await this.detector.detectAll()
      this.channel?.sendEvent('runtime_detection', { runtimes: this.cachedRuntimes })
      return this.cachedRuntimes
    })
    ipcMain.handle('runtime:cached', () => this.cachedRuntimes)
  }

  private async handleInvoke(frame: RequestFrame) {
    const payload = frame.payload as {
      sessionId: string
      cwd: string
      runtimeType?: RuntimePromptRequest['runtimeType']
      prompt?: string
      nativeSessionId?: string | null
      continueLast?: boolean
      command?: string
      args?: string[]
    }
    const { sessionId, cwd } = payload

    const onEvent = (event: RuntimeEvent) => {
      this.channel?.sendEvent('runtime_event', event as unknown as Record<string, unknown>)
    }

    if (payload.runtimeType && typeof payload.prompt === 'string') {
      onEvent({
        type: 'started',
        sessionId,
        timestamp: Date.now(),
        runtimeType: payload.runtimeType,
        cwd,
      })
      const adapter = new LocalRuntimeAdapter()
      const result = await adapter.execute({
        runtimeType: payload.runtimeType,
        prompt: payload.prompt,
        nativeSessionId: payload.nativeSessionId ?? null,
        continueLast: payload.continueLast === true,
      }, cwd)
      if (result.nativeSessionId) {
        onEvent({
          type: 'session_discovered',
          sessionId,
          timestamp: Date.now(),
          nativeSessionId: result.nativeSessionId,
        })
      }
      if (result.stdout) {
        onEvent({
          type: 'text_delta',
          sessionId,
          timestamp: Date.now(),
          delta: result.stdout,
        })
      }
      if (result.exitCode === 0) {
        onEvent({
          type: 'completed',
          sessionId,
          timestamp: Date.now(),
          exitCode: result.exitCode,
          summary: 'done',
        })
      } else {
        onEvent({
          type: 'failed',
          sessionId,
          timestamp: Date.now(),
          error: result.stderr || '本地 Runtime 执行失败',
          exitCode: result.exitCode,
        })
      }
      this.channel?.sendResponse(frame.requestId, result.exitCode === 0, result.exitCode === 0 ? undefined : result.stderr, { exitCode: result.exitCode })
      return
    }

    const command = payload.command ?? ''
    const args = payload.args ?? []
    const adapter = new StreamAdapter(sessionId)
    this.activeSessions.set(sessionId, adapter)
    const runtimeType = command.includes('codex') ? 'codex' : 'claude_code'
    const extraEnv = this.configStore?.getEnvForRuntime(runtimeType) ?? {}

    const exitCode = await adapter.execute(command, args, cwd, onEvent, extraEnv)
    this.activeSessions.delete(sessionId)
    this.channel?.sendResponse(frame.requestId, true, undefined, { exitCode })
  }

  private handleCancel(frame: RequestFrame) {
    const { sessionId } = frame.payload as { sessionId: string }
    const adapter = this.activeSessions.get(sessionId)
    if (adapter) {
      adapter.cancel()
      this.channel?.sendResponse(frame.requestId, true)
    } else {
      this.channel?.sendResponse(frame.requestId, false, '会话不存在')
    }
  }

  private async handleDetect(frame: RequestFrame) {
    this.cachedRuntimes = await this.detector.detectAll()
    this.channel?.sendEvent('runtime_detection', { runtimes: this.cachedRuntimes })
    this.channel?.sendResponse(frame.requestId, true, undefined, {
      runtimes: this.cachedRuntimes,
    })
  }
}
