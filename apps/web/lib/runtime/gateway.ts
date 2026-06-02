import type { ExecutionDomain } from '@agenthub/shared'
import type { RuntimeGatewayEvent } from '@agenthub/shared'
import { RuntimeErrorCode } from '@agenthub/shared'
import { createClient } from '@/lib/app-db-client'
import { getConnectionByUserId } from '@/server/device-connections'
import { sendRuntimeInvokeToDevice } from '@/server/device-connections'
import { getChannelByDevice, markChannelConnected } from './device-channel-store'
import { enqueue, subscribeEvents, setCancel, isWorkerAlive } from './redis-client'
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
  nativeSessionId?: string | null
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

  if (kind === 'public_cloud') {
    const { data: rows } = await db
      .from('runtime_endpoints')
      .select('id, kind, status, device_id')
      .eq('user_id', input.userId)
      .eq('kind', kind)
      .limit(1)
    const row = Array.isArray(rows) ? rows[0] : rows

    if (row) {
      return {
        id: row.id,
        kind,
        status: row.status as EndpointStatus,
        deviceId: row.device_id ?? undefined,
      }
    }

    const { data: created, error } = await db
      .from('runtime_endpoints')
      .insert({
        user_id: input.userId,
        kind,
        runtime_type: 'hosted',
        status: 'available',
      })
      .select('id, kind, status, device_id')
      .single()

    if (!error && created?.id) {
      return {
        id: created.id,
        kind,
        status: created.status as EndpointStatus,
        deviceId: created.device_id ?? undefined,
      }
    }

    return { id: null, kind, status: 'unconfigured' }
  }

  if (kind === 'user_local') {
    const { data: devices } = await db
      .from('devices')
      .select('id')
      .eq('user_id', input.userId)
      .eq('type', 'desktop')
    const deviceIds = ((devices ?? []) as unknown as Array<{ id: string }>).map((device) => device.id)
    for (const deviceId of deviceIds) {
      const { data: channels } = await db
        .from('device_runtime_channels')
        .select('endpoint_id, status, connected_at, last_heartbeat')
        .eq('device_id', deviceId)
      const channel = ((channels ?? []) as unknown as Array<{ endpoint_id: string | null; status: string; connected_at?: string | null; last_heartbeat?: string | null }>)
        .filter((row) => row.status === 'connected' && row.endpoint_id)
        .sort((a, b) => {
          const at = new Date(a.last_heartbeat ?? a.connected_at ?? 0).getTime()
          const bt = new Date(b.last_heartbeat ?? b.connected_at ?? 0).getTime()
          return bt - at
        })[0]
      if (!channel?.endpoint_id) continue

      const { data: endpoint } = await db
        .from('runtime_endpoints')
        .select('id, kind, status, device_id')
        .eq('id', channel.endpoint_id)
        .eq('user_id', input.userId)
        .eq('kind', kind)
        .single()
      if (endpoint?.id) {
        return {
          id: endpoint.id,
          kind,
          status: endpoint.status as EndpointStatus,
          deviceId: endpoint.device_id ?? deviceId,
        }
      }
    }
  }

  const { data: rows } = await db
    .from('runtime_endpoints')
    .select('id, kind, status, device_id')
    .eq('user_id', input.userId)
    .eq('kind', kind)
    .limit(1)
  const row = Array.isArray(rows) ? rows[0] : rows

  if (!row) {
    return { id: null, kind, status: 'offline' }
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
  roleAgentId?: string
}): Promise<RuntimeSessionRecord> {
  const db = await createClient()
  const { data: previousRows } = await db
    .from('runtime_sessions')
    .select('native_session_id')
    .eq('session_id', input.sessionId)
    .order('created_at', { ascending: false })
    .limit(5)
  const previous = Array.isArray(previousRows)
    ? (previousRows as Array<{ native_session_id?: string | null }>).find((row) => row.native_session_id)
    : undefined
  const { data, error } = await db
    .from('runtime_sessions')
    .insert({
      session_id: input.sessionId,
      endpoint_id: input.endpoint.id,
      role_agent_id: input.roleAgentId ?? null,
      native_session_id: previous?.native_session_id ?? null,
      status: 'idle',
    })
    .select('id')
    .single()
  if (error || !data?.id) {
    throw new Error(error?.message ?? '创建 Runtime Session 失败')
  }
  return { id: data?.id ?? '', nativeSessionId: previous?.native_session_id ?? null, endpoint: input.endpoint }
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

async function setNativeSessionId(runtimeSessionId: string, nativeSessionId: string): Promise<void> {
  if (!runtimeSessionId || !nativeSessionId) return
  const db = await createClient()
  await db.from('runtime_sessions').update({ native_session_id: nativeSessionId }).eq('id', runtimeSessionId)
}

type RuntimeDetection = {
  type?: string
  available?: boolean
  authenticated?: boolean
  launchable?: boolean
}

function parseRuntimeDetection(value: unknown): RuntimeDetection[] {
  let parsed = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown
    } catch {
      parsed = []
    }
  }
  return Array.isArray(parsed) ? parsed as RuntimeDetection[] : []
}

async function resolveLocalRuntimeInvoke(endpointId: string | null, prompt: string) {
  if (!endpointId) return null
  const db = await createClient()
  const { data } = await db
    .from('runtime_capabilities')
    .select('value')
    .eq('endpoint_id', endpointId)
    .eq('capability', 'runtime_detection')
    .limit(1)
  const row = Array.isArray(data) ? data[0] : data
  const runtimes = parseRuntimeDetection((row as { value?: unknown } | null)?.value)
  const ready = runtimes.find((runtime) =>
    (runtime.type === 'codex' || runtime.type === 'claude_code') &&
    runtime.available === true &&
    runtime.authenticated === true &&
    runtime.launchable !== false,
  )
  if (!ready?.type) return null
  if (ready.type === 'codex') {
    return { runtimeType: 'codex' as const, prompt }
  }
  return { runtimeType: 'claude_code' as const, prompt }
}

export async function* invoke(input: {
  userId: string
  runtimeSession: RuntimeSessionRecord
  userMessage?: string
  systemPrompt?: string
}): AsyncGenerator<RuntimeGatewayEvent> {
  const { endpoint } = input.runtimeSession
  const endpointId = endpoint.id ?? undefined

  yield { type: 'gateway_connected', endpointId: endpoint.id ?? '' }

  if (endpoint.kind === 'public_cloud') {
    // public_cloud routes through the self-hosted gateway worker pool (D-003). Gate on the resolved
    // endpoint status/id AND a live worker presence key — never on REDIS_URL alone. An unconfigured
    // endpoint or an enqueue with no consumer would otherwise hang until the idle timeout, so both
    // cases short-circuit to an explicit Chinese error without enqueueing (no fake assistant success).
    const emitUnavailable = async function* (reason: string): AsyncGenerator<RuntimeGatewayEvent> {
      yield { type: 'public_runtime_available', available: false, endpointId }
      yield { type: 'runtime_status', status: RuntimeErrorCode.ENDPOINT_UNAVAILABLE, endpointId }
      yield { type: 'endpoint_unavailable', endpointId, reason }
      await setSessionStatus(input.runtimeSession.id, 'failed')
    }

    if (endpoint.status === 'unconfigured' || endpoint.id === null) {
      yield* emitUnavailable('公共云端 Runtime 尚未配置，请稍后再试或切换到本地 Desktop 运行时')
      return
    }
    if (!process.env.REDIS_URL || !(await isWorkerAlive())) {
      yield* emitUnavailable('Runtime 执行器未就绪，请稍后再试或切换到本地 Desktop 运行时')
      return
    }

    yield { type: 'public_runtime_available', available: true, endpointId }
    let failed = false
    for await (const raw of subscribeEvents(input.runtimeSession.id, () => enqueue({
      runtimeSessionId: input.runtimeSession.id,
      endpointId: endpoint.id ?? undefined,
      prompt: input.userMessage ?? '',
      systemPrompt: input.systemPrompt,
    }))) {
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
  const relayDeviceId = conn?.deviceId
  if (!relayDeviceId) {
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

  await markChannelConnected(relayDeviceId, endpoint.id ?? undefined)
  yield { type: 'tunnel_connected', endpointId: endpoint.id ?? '', deviceId: relayDeviceId }
  yield { type: 'runtime_status', status: 'tunnel_ready', endpointId }
  const prompt = input.systemPrompt ? `${input.systemPrompt}\n\n${input.userMessage ?? ''}` : input.userMessage ?? ''
  const invokePayload = await resolveLocalRuntimeInvoke(endpoint.id, prompt)
  if (!invokePayload) {
    yield { type: 'runtime_failed', endpointId, error: '本地 Claude Code / Codex 未登录或不可启动，无法执行本地任务。' }
    await setSessionStatus(input.runtimeSession.id, 'failed')
    return
  }

  await setSessionStatus(input.runtimeSession.id, 'running')
  for await (const event of sendRuntimeInvokeToDevice(relayDeviceId, {
    sessionId: input.runtimeSession.id,
    runtimeType: invokePayload.runtimeType,
    prompt: invokePayload.prompt,
    nativeSessionId: input.runtimeSession.nativeSessionId ?? null,
    cwd: process.env.RUNTIME_CWD ?? process.cwd(),
  })) {
    if (event.type === 'response') {
      if (!event.ok) {
        yield { type: 'runtime_failed', endpointId, error: event.error ?? '本地 Runtime 执行失败' }
        await setSessionStatus(input.runtimeSession.id, 'failed')
      }
      continue
    }
    if (event.type === 'started') {
      yield { type: 'runtime_status', status: 'running', endpointId }
    } else if (event.type === 'session_discovered') {
      await setNativeSessionId(input.runtimeSession.id, event.nativeSessionId)
      yield { type: 'native_session', nativeSessionId: event.nativeSessionId, endpointId }
    } else if (event.type === 'text_delta') {
      yield { type: 'runtime_output', delta: event.delta, endpointId }
    } else if (event.type === 'completed') {
      yield { type: 'runtime_completed', endpointId, summary: event.summary ?? 'done' }
      await setSessionStatus(input.runtimeSession.id, 'completed')
    } else if (event.type === 'failed') {
      yield { type: 'runtime_failed', endpointId, error: event.error }
      await setSessionStatus(input.runtimeSession.id, 'failed')
    } else if (event.type === 'cancelled') {
      yield { type: 'runtime_cancelled', endpointId, reason: event.reason }
      await setSessionStatus(input.runtimeSession.id, 'cancelled')
    }
  }
}

export async function cancelRuntimeSession(runtimeSessionId: string): Promise<void> {
  await setCancel(runtimeSessionId)
}
