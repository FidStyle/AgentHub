import { SeqGenerator, type RequestFrame } from '@agenthub/shared'
import { getConnectionByUserId, sendRequestToDevice } from '../server/device-connections'

const seq = new SeqGenerator()

export function sendRuntimeInvoke(
  userId: string,
  payload: { sessionId: string; command: string; args: string[]; cwd: string },
): { sent: boolean; error?: string } {
  const conn = getConnectionByUserId(userId)
  if (!conn) return { sent: false, error: '设备未连接' }

  const frame: RequestFrame = {
    type: 'request',
    seq: seq.next(),
    requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    requestType: 'runtime_invoke',
    payload,
  }

  const sent = sendRequestToDevice(conn.deviceId, frame)
  return { sent, error: sent ? undefined : '发送失败' }
}

export function sendRuntimeCancel(userId: string, sessionId: string): { sent: boolean; error?: string } {
  const conn = getConnectionByUserId(userId)
  if (!conn) return { sent: false, error: '设备未连接' }

  const frame: RequestFrame = {
    type: 'request',
    seq: seq.next(),
    requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    requestType: 'runtime_cancel',
    payload: { sessionId },
  }

  const sent = sendRequestToDevice(conn.deviceId, frame)
  return { sent, error: sent ? undefined : '发送失败' }
}
