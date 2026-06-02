import type { WebSocket } from 'ws'
import { SeqGenerator, type DeviceFrame, type RequestFrame, type ResponseFrame, type RuntimeEvent } from '@agenthub/shared'
import { getRedis } from '../lib/runtime/redis-client'

interface DeviceConnection {
  ws: WebSocket
  deviceId: string
  userId: string
  workspaceIds: string[]
  lastHeartbeat: number
}

const DEVICE_REQUEST_CHANNEL = 'agenthub:device:requests'
const DEVICE_EVENT_CHANNEL = 'agenthub:device:events'

type RuntimeRelay = {
  queue: Array<RuntimeEvent | ResponseFrame>
  done: boolean
  wake: (() => void) | null
  timer: NodeJS.Timeout
}

type DeviceConnectionState = {
  connections: Map<string, DeviceConnection>
  seq: SeqGenerator
  requestToSession: Map<string, string>
  redisBridgeStarted: boolean
  runtimeRelays: Map<string, RuntimeRelay>
}

const DEVICE_CONNECTION_STATE_KEY = '__agenthubDeviceConnectionState'
const deviceConnectionGlobal = globalThis as typeof globalThis & {
  [DEVICE_CONNECTION_STATE_KEY]?: DeviceConnectionState
}
const deviceConnectionState = deviceConnectionGlobal[DEVICE_CONNECTION_STATE_KEY] ??= {
  connections: new Map<string, DeviceConnection>(),
  seq: new SeqGenerator(),
  requestToSession: new Map<string, string>(),
  redisBridgeStarted: false,
  runtimeRelays: new Map<string, RuntimeRelay>(),
}

const { connections, seq, requestToSession, runtimeRelays } = deviceConnectionState

type DeviceRequestRelayMessage = {
  deviceId: string
  frame: RequestFrame
}

type DeviceEventRelayMessage = {
  sessionId: string
  event: RuntimeEvent | ResponseFrame
}

export function addConnection(deviceId: string, conn: DeviceConnection) {
  connections.set(deviceId, conn)
}

export function removeConnection(deviceId: string) {
  connections.delete(deviceId)
}

export function getConnection(deviceId: string): DeviceConnection | undefined {
  return connections.get(deviceId)
}

export function getConnectionByUserId(userId: string): DeviceConnection | undefined {
  for (const conn of connections.values()) {
    if (conn.userId === userId) return conn
  }
  return undefined
}

export function sendToDevice(deviceId: string, frame: DeviceFrame): boolean {
  const conn = connections.get(deviceId)
  if (!conn || conn.ws.readyState !== 1) return false
  conn.ws.send(JSON.stringify(frame))
  return true
}

export function sendRequestToDevice(deviceId: string, request: RequestFrame): boolean {
  return sendToDevice(deviceId, request)
}

export async function startDeviceRequestRedisBridge(): Promise<void> {
  if (deviceConnectionState.redisBridgeStarted) return
  deviceConnectionState.redisBridgeStarted = true
  const subscriber = (await getRedis()).duplicate()
  await subscriber.connect()
  await subscriber.subscribe(DEVICE_REQUEST_CHANNEL, (msg) => {
    try {
      const { deviceId, frame } = JSON.parse(msg) as DeviceRequestRelayMessage
      if (!deviceId || !frame?.requestId) return
      requestToSession.set(frame.requestId, String((frame.payload as { sessionId?: unknown })?.sessionId ?? ''))
      sendRequestToDevice(deviceId, frame)
    } catch (error) {
      console.error('[device-relay] request parse failed', error)
    }
  })
}

async function publishDeviceRequest(deviceId: string, frame: RequestFrame): Promise<void> {
  const r = await getRedis()
  await r.publish(DEVICE_REQUEST_CHANNEL, JSON.stringify({ deviceId, frame } satisfies DeviceRequestRelayMessage))
}

async function subscribeDeviceEvents(sessionId: string, onEvent: (event: RuntimeEvent | ResponseFrame) => void): Promise<() => Promise<void>> {
  const subscriber = (await getRedis()).duplicate()
  await subscriber.connect()
  await subscriber.subscribe(DEVICE_EVENT_CHANNEL, (msg) => {
    try {
      const relay = JSON.parse(msg) as DeviceEventRelayMessage
      if (relay.sessionId === sessionId) onEvent(relay.event)
    } catch {
      // Ignore malformed relay messages; they are not product events.
    }
  })
  return async () => {
    await subscriber.unsubscribe(DEVICE_EVENT_CHANNEL)
    await subscriber.quit()
  }
}

async function publishDeviceEvent(sessionId: string, event: RuntimeEvent | ResponseFrame): Promise<void> {
  if (!sessionId) return
  const r = await getRedis()
  await r.publish(DEVICE_EVENT_CHANNEL, JSON.stringify({ sessionId, event } satisfies DeviceEventRelayMessage))
}

function pushRelay(runtimeSessionId: string, event: RuntimeEvent | ResponseFrame) {
  const relay = runtimeRelays.get(runtimeSessionId)
  if (!relay) return
  relay.queue.push(event)
  if (
    event.type === 'response' ||
    event.type === 'completed' ||
    event.type === 'failed' ||
    event.type === 'cancelled'
  ) {
    relay.done = true
  }
  relay.wake?.()
}

export async function* sendRuntimeInvokeToDevice(
  deviceId: string,
  payload: {
    sessionId: string
    runtimeType: 'claude_code' | 'codex'
    prompt: string
    nativeSessionId?: string | null
    continueLast?: boolean
    cwd: string
  },
  timeoutMs = Number(process.env.DEVICE_RUNTIME_INVOKE_TIMEOUT_MS ?? 300000),
): AsyncGenerator<RuntimeEvent | ResponseFrame> {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const relay = {
    queue: [] as Array<RuntimeEvent | ResponseFrame>,
    done: false,
    wake: null as (() => void) | null,
    timer: setTimeout(() => {
      pushRelay(payload.sessionId, {
        type: 'failed',
        sessionId: payload.sessionId,
        timestamp: Date.now(),
        error: '本地 Desktop Runtime 响应超时',
      })
    }, timeoutMs),
  }
  runtimeRelays.set(payload.sessionId, relay)
  requestToSession.set(requestId, payload.sessionId)
  const unsubscribeRedisEvents = await subscribeDeviceEvents(payload.sessionId, (event) => pushRelay(payload.sessionId, event))

  const requestFrame: RequestFrame = {
    type: 'request',
    seq: seq.next(),
    requestId,
    requestType: 'runtime_invoke',
    payload,
  }
  const sent = sendRequestToDevice(deviceId, requestFrame)
  if (!sent) {
    try {
      await publishDeviceRequest(deviceId, requestFrame)
    } catch {
      clearTimeout(relay.timer)
      runtimeRelays.delete(payload.sessionId)
      requestToSession.delete(requestId)
      await unsubscribeRedisEvents()
      yield {
        type: 'failed',
        sessionId: payload.sessionId,
        timestamp: Date.now(),
        error: '本地 Desktop 通道发送失败',
      }
      return
    }
  }

  try {
    while (true) {
      while (relay.queue.length > 0) yield relay.queue.shift()!
      if (relay.done) break
      await new Promise<void>((resolve) => { relay.wake = resolve })
      relay.wake = null
    }
  } finally {
    clearTimeout(relay.timer)
    runtimeRelays.delete(payload.sessionId)
    requestToSession.delete(requestId)
    await unsubscribeRedisEvents()
  }
}

export function deliverDeviceResponse(frame: ResponseFrame) {
  const sessionId = requestToSession.get(frame.requestId)
  if (!sessionId) return
  pushRelay(sessionId, frame)
  void publishDeviceEvent(sessionId, frame)
}

export function deliverDeviceRuntimeEvent(event: RuntimeEvent) {
  pushRelay(event.sessionId, event)
  void publishDeviceEvent(event.sessionId, event)
}

export function updateHeartbeat(deviceId: string) {
  const conn = connections.get(deviceId)
  if (conn) conn.lastHeartbeat = Date.now()
}

export function getAllConnections(): Map<string, DeviceConnection> {
  return connections
}
