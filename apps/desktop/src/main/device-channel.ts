import WebSocket from 'ws'
import { BrowserWindow } from 'electron'
import {
  serializeFrame,
  parseFrame,
  SeqGenerator,
  type AuthFrame,
  type HeartbeatFrame,
  type ResponseFrame,
  type EventFrame,
  type RequestFrame,
  type DeviceFrame,
} from '@agenthub/shared'
import { registerDeviceChannelHandlers } from './device-channel-ipc'

export type ConnectionState = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'reconnecting'

interface DeviceChannelConfig {
  gatewayUrl: string
  deviceToken: string
}

export class DeviceChannel {
  private ws: WebSocket | null = null
  private seq = new SeqGenerator()
  private state: ConnectionState = 'disconnected'
  private config: DeviceChannelConfig | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private maxReconnectDelay = 16000
  private requestHandlers = new Map<string, (frame: RequestFrame) => void>()

  constructor() {
    registerDeviceChannelHandlers(this)
  }

  connect(config: DeviceChannelConfig) {
    this.config = config
    this.setState('connecting')
    this.seq.reset()

    this.ws = new WebSocket(config.gatewayUrl)

    this.ws.on('open', () => {
      this.setState('authenticating')
      const authFrame: AuthFrame = {
        type: 'auth',
        seq: this.seq.next(),
        deviceToken: config.deviceToken,
      }
      this.ws!.send(serializeFrame(authFrame))
    })

    this.ws.on('message', (data) => {
      const frame = parseFrame(data.toString())
      if (!frame) return
      this.handleFrame(frame)
    })

    this.ws.on('close', () => {
      this.stopHeartbeat()
      if (this.state === 'connected' || this.state === 'authenticating') {
        this.setState('reconnecting')
        this.scheduleReconnect()
      } else {
        this.setState('disconnected')
      }
    })

    this.ws.on('error', () => {
      // close event will handle reconnection
    })
  }

  private handleFrame(frame: DeviceFrame) {
    switch (frame.type) {
      case 'connected':
        this.setState('connected')
        this.reconnectAttempts = 0
        this.startHeartbeat()
        break
      case 'heartbeat_ack':
        break
      case 'request':
        this.handleRequest(frame as RequestFrame)
        break
    }
  }

  private handleRequest(frame: RequestFrame) {
    const handler = this.requestHandlers.get(frame.requestType)
    if (handler) {
      handler(frame)
    } else {
      this.sendResponse(frame.requestId, false, '不支持的请求类型')
    }
  }

  onRequest(type: string, handler: (frame: RequestFrame) => void) {
    this.requestHandlers.set(type, handler)
  }

  sendResponse(requestId: string, ok: boolean, error?: string, payload?: Record<string, unknown>) {
    if (!this.ws || this.state !== 'connected') return
    const frame: ResponseFrame = {
      type: 'response',
      seq: this.seq.next(),
      requestId,
      ok,
      error,
      payload,
    }
    this.ws.send(serializeFrame(frame))
  }

  sendEvent(eventType: string, payload: Record<string, unknown>) {
    if (!this.ws || this.state !== 'connected') return
    const frame: EventFrame = {
      type: 'event',
      seq: this.seq.next(),
      eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      eventType,
      payload,
    }
    this.ws.send(serializeFrame(frame))
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.state !== 'connected') return
      const frame: HeartbeatFrame = {
        type: 'heartbeat',
        seq: this.seq.next(),
        sentAt: Date.now(),
      }
      this.ws.send(serializeFrame(frame))
    }, 30000)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay)
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => {
      if (this.config) this.connect(this.config)
    }, delay)
  }

  disconnect() {
    this.setState('disconnected')
    this.stopHeartbeat()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private setState(state: ConnectionState) {
    this.state = state
    this.notifyRenderer('device-channel:state-changed', state)
  }

  private notifyRenderer(channel: string, data: unknown) {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send(channel, data)
    }
  }

  getState(): ConnectionState {
    return this.state
  }
}
