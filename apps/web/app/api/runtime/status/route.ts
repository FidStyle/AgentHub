import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'

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
  status: string
  connected_at?: string | null
  last_heartbeat?: string | null
}

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
  let connectedChannel: ChannelRow | null = null

  for (const deviceId of deviceIds) {
    const { data: channels, error: channelError } = await db
      .from('device_runtime_channels')
      .select('device_id, status, connected_at, last_heartbeat')
      .eq('device_id', deviceId)

    if (channelError) return NextResponse.json({ error: channelError.message }, { status: 500 })
    connectedChannel = latestConnectedChannel([...(connectedChannel ? [connectedChannel] : []), ...((channels ?? []) as unknown as ChannelRow[])])
  }

  const connectedDevice = connectedChannel
    ? desktopDevices.find((device) => device.id === connectedChannel?.device_id) ?? null
    : null

  return NextResponse.json({
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
      status: connectedDevice ? 'ready' : 'unavailable',
      description: connectedDevice
        ? '本地 Desktop 已连接，Claude Code / Codex 将通过 Cloud Runtime Gateway 转发到本机 CLI。'
        : '本地 Desktop 未连接，无法创建或使用本地桌面工作区。',
    },
  })
}
