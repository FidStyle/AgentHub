import type { WebSocket } from 'ws'
import type { DeviceFrame, RequestFrame } from '@agenthub/shared'

interface DeviceConnection {
  ws: WebSocket
  deviceId: string
  userId: string
  workspaceIds: string[]
  lastHeartbeat: number
}

const connections = new Map<string, DeviceConnection>()

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

export function updateHeartbeat(deviceId: string) {
  const conn = connections.get(deviceId)
  if (conn) conn.lastHeartbeat = Date.now()
}

export function getAllConnections(): Map<string, DeviceConnection> {
  return connections
}
