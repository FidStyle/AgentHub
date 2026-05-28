import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { Server } from 'http'
import { parseFrame, type AuthFrame, type HeartbeatAckFrame, type ConnectedFrame } from '@agenthub/shared'
import { addConnection, removeConnection, updateHeartbeat, getAllConnections } from './device-connections'
import { createClient } from '../lib/app-db-client'

function createAdminClient() {
  return createClient()
}

export function setupWebSocketGateway(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws/device' })

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    let authenticated = false
    let deviceId = ''
    let authTimeout: NodeJS.Timeout | null = null

    authTimeout = setTimeout(() => {
      if (!authenticated) ws.close(4001, '鉴权超时')
    }, 10000)

    ws.on('message', async (data) => {
      const frame = parseFrame(data.toString())
      if (!frame) return

      if (!authenticated) {
        if (frame.type !== 'auth') {
          ws.close(4002, '首帧必须为 auth')
          return
        }
        const authFrame = frame as AuthFrame
        const db = await createAdminClient()
        const { data: device } = await db
          .from('devices')
          .select('id, user_id')
          .eq('device_token', authFrame.deviceToken)
          .single()

        if (!device) {
          ws.close(4003, 'device_token 无效')
          return
        }

        deviceId = device.id
        authenticated = true
        if (authTimeout) clearTimeout(authTimeout)

        const { data: workspaces } = await db
          .from('workspaces')
          .select('id')
          .eq('owner_id', device.user_id)
          .eq('execution_domain', 'local_desktop')

        const workspaceIds = (workspaces || []).map((w: { id: string }) => w.id)

        addConnection(deviceId, {
          ws,
          deviceId,
          userId: device.user_id,
          workspaceIds,
          lastHeartbeat: Date.now(),
        })

        await db.from('devices').update({ online: true }).eq('id', deviceId)

        const connectedFrame: ConnectedFrame = {
          type: 'connected',
          seq: 0,
          deviceId,
          workspaceIds,
        }
        ws.send(JSON.stringify(connectedFrame))
        return
      }

      switch (frame.type) {
        case 'heartbeat': {
          updateHeartbeat(deviceId)
          const ack: HeartbeatAckFrame = {
            type: 'heartbeat_ack',
            seq: frame.seq,
            sentAt: frame.sentAt,
          }
          ws.send(JSON.stringify(ack))
          break
        }
        case 'response':
        case 'event':
          // 路由到对应的请求处理器（后续 TASK-008 实现）
          break
      }
    })

    ws.on('close', async () => {
      if (deviceId) {
        removeConnection(deviceId)
        const db = await createAdminClient()
        await db.from('devices').update({ online: false }).eq('id', deviceId)
      }
    })
  })

  // 心跳检测：每 30s 检查连接活性
  setInterval(() => {
    const now = Date.now()
    for (const [id, conn] of getAllConnections()) {
      if (now - conn.lastHeartbeat > 90000) {
        conn.ws.close(4004, '心跳超时')
        removeConnection(id)
      }
    }
  }, 30000)

  return wss
}
