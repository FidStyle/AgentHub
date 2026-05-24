import { ipcMain } from 'electron'
import type { RuntimeEvent, RequestFrame } from '@agenthub/shared'
import { StreamAdapter } from './stream-adapter'
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
      return this.cachedRuntimes
    })
    ipcMain.handle('runtime:cached', () => this.cachedRuntimes)
  }

  private async handleInvoke(frame: RequestFrame) {
    const { sessionId, command, args, cwd } = frame.payload as {
      sessionId: string
      command: string
      args: string[]
      cwd: string
    }

    const adapter = new StreamAdapter(sessionId)
    this.activeSessions.set(sessionId, adapter)

    const onEvent = (event: RuntimeEvent) => {
      this.channel?.sendEvent('runtime_event', event as unknown as Record<string, unknown>)
    }

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
    this.channel?.sendResponse(frame.requestId, true, undefined, {
      runtimes: this.cachedRuntimes,
    })
  }
}
