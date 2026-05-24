export type FrameType =
  | 'auth'
  | 'connected'
  | 'heartbeat'
  | 'heartbeat_ack'
  | 'request'
  | 'response'
  | 'event'

export interface BaseFrame {
  type: FrameType
  seq: number
}

export interface AuthFrame extends BaseFrame {
  type: 'auth'
  deviceToken: string
}

export interface ConnectedFrame extends BaseFrame {
  type: 'connected'
  deviceId: string
  workspaceIds: string[]
}

export interface HeartbeatFrame extends BaseFrame {
  type: 'heartbeat'
  sentAt: number
}

export interface HeartbeatAckFrame extends BaseFrame {
  type: 'heartbeat_ack'
  sentAt: number
}

export type RequestType = 'runtime_invoke' | 'runtime_cancel' | 'action_execute' | 'detect_runtime'

export interface RequestFrame extends BaseFrame {
  type: 'request'
  requestId: string
  requestType: RequestType
  payload: Record<string, unknown>
}

export interface ResponseFrame extends BaseFrame {
  type: 'response'
  requestId: string
  ok: boolean
  error?: string
  payload?: Record<string, unknown>
}

export interface EventFrame extends BaseFrame {
  type: 'event'
  eventId: string
  eventType: string
  payload: Record<string, unknown>
}

export type DeviceFrame =
  | AuthFrame
  | ConnectedFrame
  | HeartbeatFrame
  | HeartbeatAckFrame
  | RequestFrame
  | ResponseFrame
  | EventFrame

export function serializeFrame(frame: DeviceFrame): string {
  return JSON.stringify(frame)
}

export function parseFrame(data: string): DeviceFrame | null {
  try {
    const parsed = JSON.parse(data)
    if (parsed && typeof parsed.type === 'string' && typeof parsed.seq === 'number') {
      return parsed as DeviceFrame
    }
    return null
  } catch {
    return null
  }
}

export class SeqGenerator {
  private seq = 0
  next(): number {
    return ++this.seq
  }
  reset(): void {
    this.seq = 0
  }
}
