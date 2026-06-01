import type { WebSocket } from 'ws'
import { SeqGenerator, type DeviceFrame, type RequestFrame, type ResponseFrame, type RuntimeEvent } from '@agenthub/shared'

interface DeviceConnection {
  ws: WebSocket
  deviceId: string
  userId: string
  workspaceIds: string[]
  lastHeartbeat: number
}

const connections = new Map<string, DeviceConnection>()
const seq = new SeqGenerator()
const requestToSession = new Map<string, string>()
const runtimeRelays = new Map<string, {
  queue: Array<RuntimeEvent | ResponseFrame>
  done: boolean
  wake: (() => void) | null
  timer: NodeJS.Timeout
}>()

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

  const sent = sendRequestToDevice(deviceId, {
    type: 'request',
    seq: seq.next(),
    requestId,
    requestType: 'runtime_invoke',
    payload,
  })
  if (!sent) {
    clearTimeout(relay.timer)
    runtimeRelays.delete(payload.sessionId)
    requestToSession.delete(requestId)
    yield {
      type: 'failed',
      sessionId: payload.sessionId,
      timestamp: Date.now(),
      error: '本地 Desktop 通道发送失败',
    }
    return
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
  }
}

export function deliverDeviceResponse(frame: ResponseFrame) {
  const sessionId = requestToSession.get(frame.requestId)
  if (!sessionId) return
  pushRelay(sessionId, frame)
}

export function deliverDeviceRuntimeEvent(event: RuntimeEvent) {
  pushRelay(event.sessionId, event)
}

export function updateHeartbeat(deviceId: string) {
  const conn = connections.get(deviceId)
  if (conn) conn.lastHeartbeat = Date.now()
}

export function getAllConnections(): Map<string, DeviceConnection> {
  return connections
}
