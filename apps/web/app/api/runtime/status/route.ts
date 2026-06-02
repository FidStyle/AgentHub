import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'
import { getConnectionByUserId } from '@/server/device-connections'

type DeviceRow = {
  id: string
  name: string
  type: string
  online?: boolean
  last_heartbeat?: string | null
  created_at?: string
}

type ChannelRow = {
  device_id: string
  endpoint_id?: string | null
  status: string
  connected_at?: string | null
  last_heartbeat?: string | null
}

type RuntimeCapabilityRow = {
  capability: string
  value: unknown
}

type BlockReason =
  | 'desktop_not_bound'
  | 'desktop_offline'
  | 'runtime_status_unknown'
  | 'runtime_missing'
  | 'runtime_auth_required'
  | 'native_session_unavailable'

function latestConnectedChannel(
  channels: ChannelRow[],
) {
  return channels
    .filter((channel) => channel.status === 'connected')
    .sort((a, b) => {
      const at = new Date(a.last_heartbeat ?? a.connected_at ?? 0).getTime()
      const bt = new Date(b.last_heartbeat ?? b.connected_at ?? 0).getTime()
      return bt - at
    })[0] ?? null
}

function parseCapabilityValue(value: unknown) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown
    } catch {
      return null
    }
  }
  return value
}

function runtimeDoctorReady(capabilities: RuntimeCapabilityRow[]) {
  const detection = capabilities.find((capability) => capability.capability === 'runtime_detection')
  const value = parseCapabilityValue(detection?.value)
  if (!Array.isArray(value)) return { ready: false, known: false }

  const runnable = value.filter((runtime): runtime is { available?: boolean; authenticated?: boolean; launchable?: boolean } =>
    Boolean(runtime) && typeof runtime === 'object',
  )
  return {
    ready: runnable.some((runtime) => runtime.available === true && runtime.authenticated === true && runtime.launchable !== false),
    known: true,
  }
}

export async function GET() {
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { data: devices, error: devicesError } = await db
    .from('devices')
    .select('id, name, type, online, last_heartbeat, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (devicesError) return NextResponse.json({ error: devicesError.message }, { status: 500 })

  const desktopDevices = ((devices ?? []) as unknown as DeviceRow[]).filter((device) => device.type === 'desktop')
  const deviceIds = desktopDevices.map((device) => device.id)
  const liveConnection = getConnectionByUserId(user.id)
  let connectedChannel: ChannelRow | null = null

  for (const deviceId of deviceIds) {
    if (liveConnection?.deviceId !== deviceId) continue
    const { data: channels, error: channelError } = await db
      .from('device_runtime_channels')
      .select('device_id, endpoint_id, status, connected_at, last_heartbeat')
      .eq('device_id', deviceId)

    if (channelError) return NextResponse.json({ error: channelError.message }, { status: 500 })
    connectedChannel = latestConnectedChannel([...(connectedChannel ? [connectedChannel] : []), ...((channels ?? []) as unknown as ChannelRow[])])
  }

  const connectedDevice = connectedChannel
    ? desktopDevices.find((device) => device.id === connectedChannel?.device_id) ?? null
    : null

  let capabilities: RuntimeCapabilityRow[] = []
  if (connectedChannel?.endpoint_id) {
    const { data, error } = await db
      .from('runtime_capabilities')
      .select('capability, value')
      .eq('endpoint_id', connectedChannel.endpoint_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    capabilities = (data ?? []) as unknown as RuntimeCapabilityRow[]
  }

  const doctor = runtimeDoctorReady(capabilities)
  const blockReason: BlockReason | null = !connectedDevice
    ? desktopDevices.length > 0 ? 'desktop_offline' : 'desktop_not_bound'
    : !doctor.known
      ? 'runtime_status_unknown'
      : !doctor.ready
        ? 'runtime_auth_required'
        : null
  const operable = connectedDevice !== null && doctor.ready
  const nativeSessionAvailable = operable
  const nativeSessionDescription = nativeSessionAvailable
    ? '本地 Claude Code / Codex 支持官方原生会话续接；AgentHub 会记录并复用 native session id。'
    : '本地 Claude Code / Codex 原生会话续接需 Desktop 在线且 CLI 通过真实检测。'
  const blockReasonText: Record<BlockReason, string> = {
    desktop_not_bound: '尚未绑定 AgentHub Desktop，只能查看历史。',
    desktop_offline: '本地 Desktop 未连接云端，只能查看历史。',
    runtime_status_unknown: '本地 Runtime 尚未完成真实检测，只能查看历史。',
    runtime_missing: '本地 Claude Code / Codex 未安装，只能查看历史。',
    runtime_auth_required: '本地 Claude Code / Codex 未登录或不可启动，只能查看历史。',
    native_session_unavailable: '本地 CLI 会话暂不可恢复，只能查看历史。',
  }

  return NextResponse.json({
    readOnlyAvailable: true,
    operable,
    blockReason,
    blockReasonText: blockReason ? blockReasonText[blockReason] : null,
    user: {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
    },
    desktop: {
      status: connectedDevice ? 'connected' : desktopDevices.length > 0 ? 'disconnected' : 'not_bound',
      connected: Boolean(connectedDevice),
      device: connectedDevice
        ? {
            id: connectedDevice.id,
            name: connectedDevice.name,
            last_heartbeat: connectedChannel?.last_heartbeat ?? connectedDevice.last_heartbeat ?? null,
          }
        : null,
    },
    runtime: {
      status: operable ? 'ready' : 'unavailable',
      doctorKnown: doctor.known,
      nativeSessionAvailable,
      nativeSessionDescription,
      description: operable
        ? `本地 Desktop 已连接，且 Claude Code / Codex 已通过真实检测。${nativeSessionDescription}`
        : blockReason ? blockReasonText[blockReason] : '本地 Runtime 暂不可用。',
    },
  })
}
