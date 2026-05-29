import { createClient } from '@/lib/app-db-client'

export interface DeviceRuntimeChannel {
  id: string
  device_id: string
  endpoint_id: string | null
  status: 'connected' | 'disconnected'
  connected_at: string | null
  last_heartbeat: string | null
}

async function findByDevice(deviceId: string): Promise<DeviceRuntimeChannel | null> {
  const db = await createClient()
  const { data } = await db
    .from('device_runtime_channels')
    .select('id, device_id, endpoint_id, status, connected_at, last_heartbeat')
    .eq('device_id', deviceId)
    .limit(1)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    id: row.id,
    device_id: row.device_id,
    endpoint_id: row.endpoint_id ?? null,
    status: row.status,
    connected_at: row.connected_at ?? null,
    last_heartbeat: row.last_heartbeat ?? null,
  }
}

export async function getChannelByDevice(deviceId: string): Promise<DeviceRuntimeChannel | null> {
  return findByDevice(deviceId)
}

export async function markChannelConnected(deviceId: string, endpointId?: string): Promise<void> {
  const db = await createClient()
  const now = new Date().toISOString()
  const existing = await findByDevice(deviceId)
  if (existing) {
    await db
      .from('device_runtime_channels')
      .update({ status: 'connected', connected_at: now, last_heartbeat: now, ...(endpointId ? { endpoint_id: endpointId } : {}) })
      .eq('device_id', deviceId)
  } else {
    await db
      .from('device_runtime_channels')
      .insert({ device_id: deviceId, endpoint_id: endpointId ?? null, status: 'connected', connected_at: now, last_heartbeat: now })
  }
}

export async function markChannelDisconnected(deviceId: string): Promise<void> {
  const db = await createClient()
  const existing = await findByDevice(deviceId)
  if (!existing) return
  await db.from('device_runtime_channels').update({ status: 'disconnected' }).eq('device_id', deviceId)
}
