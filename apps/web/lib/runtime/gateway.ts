import type { ExecutionDomain } from '@agenthub/shared'
import type { RuntimeGatewayEvent } from '@agenthub/shared'
import { RuntimeErrorCode } from '@agenthub/shared'
import { createClient } from '@/lib/app-db-client'
import { getConnectionByUserId } from '@/server/device-connections'
import { getChannelByDevice, markChannelConnected } from './device-channel-store'
import { enqueue, subscribeEvents, setCancel } from './redis-client'
import { redact } from './redact'

type EndpointKind = 'public_cloud' | 'user_local'
type EndpointStatus = 'available' | 'offline' | 'unconfigured'

export interface ResolvedEndpoint {
  id: string | null
  kind: EndpointKind
  status: EndpointStatus
  deviceId?: string
}

export interface RuntimeSessionRecord {
  id: string
  endpoint: ResolvedEndpoint
}

const LOCAL_HOST_PATTERN =
  /^(localhost|127\.|0\.0\.0\.0|::1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i

// Web/Mobile must never target a local IP/port directly — runtime route uses endpointId only.
export function isLocalNetworkTarget(target: string): boolean {
  if (!target) return false
  const host = target.replace(/^[a-z]+:\/\//i, '').split(/[/:]/)[0]
  return LOCAL_HOST_PATTERN.test(host)
}

export async function resolveEndpoint(input: {
  userId: string
  workspaceId: string
  executionDomain: ExecutionDomain
}): Promise<ResolvedEndpoint> {
  const db = await createClient()
  const kind: EndpointKind = input.executionDomain === 'local_desktop' ? 'user_local' : 'public_cloud'

  const { data: rows } = await db
    .from('runtime_endpoints')
    .select('id, kind, status, device_id')
    .eq('user_id', input.userId)
    .eq('kind', kind)
    .limit(1)
  const row = Array.isArray(rows) ? rows[0] : rows

  if (!row) {
    return { id: null, kind, status: kind === 'public_cloud' ? 'unconfigured' : 'offline' }
  }
  return {
    id: row.id,
    kind,
    status: row.status as EndpointStatus,
    deviceId: row.device_id ?? undefined,
  }
}

export async function createSession(input: {
  sessionId: string
  endpoint: ResolvedEndpoint
}): Promise<RuntimeSessionRecord> {
  const db = await createClient()
  const { data } = await db
    .from('runtime_sessions')
    .insert({
      session_id: input.sessionId,
      endpoint_id: input.endpoint.id,
      status: 'idle',
    })
    .select('id')
    .single()
  return { id: data?.id ?? '', endpoint: input.endpoint }
}

export async function persistRuntimeEvent(
  runtimeSessionId: string,
  event: RuntimeGatewayEvent,
  seq: number,
): Promise<void> {
  if (!runtimeSessionId) return
  const db = await createClient()
  const { type, ...rest } = event
  await db.from('runtime_logs').insert({
    runtime_session_id: runtimeSessionId,
    event_type: type,
    payload: redact(rest as Record<string, unknown>),
    seq,
  })
}

async function setSessionStatus(runtimeSessionId: string, status: string): Promise<void> {
  if (!runtimeSessionId) return
  const db = await createClient()
  await db.from('runtime_sessions').update({ status }).eq('id', runtimeSessionId)
}

export async function* invoke(input: {
  userId: string
  runtimeSession: RuntimeSessionRecord
  userMessage?: string
}): AsyncGenerator<RuntimeGatewayEvent> {
  const { endpoint } = input.runtimeSession
  const endpointId = endpoint.id ?? undefined

  yield { type: 'gateway_connected', endpointId: endpoint.id ?? '' }

  if (endpoint.kind === 'public_cloud') {
    // public_cloud routes through the self-hosted gateway worker pool (D-003). When Redis is
    // unreachable the endpoint stays unconfigured — no fake assistant success.
    if (!process.env.REDIS_URL) {
      yield { type: 'public_runtime_available', available: false, endpointId }
      yield { type: 'runtime_status', status: RuntimeErrorCode.ENDPOINT_UNAVAILABLE, endpointId }
      yield {
        type: 'endpoint_unavailable',
        endpointId,
        reason: '公共云端 Runtime 尚未配置，请稍后再试或切换到本地 Desktop 运行时',
      }
      await setSessionStatus(input.runtimeSession.id, 'failed')
      return
    }

    yield { type: 'public_runtime_available', available: true, endpointId }
    await enqueue({
      runtimeSessionId: input.runtimeSession.id,
      endpointId: endpoint.id ?? undefined,
      prompt: input.userMessage ?? '',
    })
    let failed = false
    for await (const raw of subscribeEvents(input.runtimeSession.id)) {
      const evt = raw as RuntimeGatewayEvent
      if (evt.type === 'runtime_failed') failed = true
      yield evt
    }
    // subscribeEvents returns on terminal event OR dual-timeout sentinel; either
    // runtime_failed path must land the session as failed (never silently complete).
    if (failed) await setSessionStatus(input.runtimeSession.id, 'failed')
    return
  }

  // user_local: relay through Gateway/DeviceChannel; remote clients never touch local ports.
  const conn = getConnectionByUserId(input.userId)
  if (!conn) {
    // Distinguish "was connected then dropped" (tunnel_disconnected) from "never connected" (local_runtime_offline).
    const channel = endpoint.deviceId ? await getChannelByDevice(endpoint.deviceId) : null
    if (channel?.connected_at) {
      yield { type: 'tunnel_disconnected', endpointId: endpoint.id ?? '', deviceId: endpoint.deviceId ?? '' }
    } else {
      yield { type: 'local_runtime_offline', endpointId, deviceId: endpoint.deviceId }
    }
    // Preserve DEVICE_OFFLINE compatibility for P0 tests.
    yield { type: 'runtime_status', status: RuntimeErrorCode.DEVICE_OFFLINE, endpointId }
    await setSessionStatus(input.runtimeSession.id, 'failed')
    return
  }

  await markChannelConnected(conn.deviceId, endpoint.id ?? undefined)
  yield { type: 'tunnel_connected', endpointId: endpoint.id ?? '', deviceId: conn.deviceId }
  yield { type: 'runtime_status', status: 'tunnel_ready', endpointId }
}

export async function cancelRuntimeSession(runtimeSessionId: string): Promise<void> {
  await setCancel(runtimeSessionId)
}
