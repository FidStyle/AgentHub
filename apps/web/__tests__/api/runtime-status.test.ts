import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  resetMockAuth,
  resetMockClient,
  setupMockAuth,
  setupMockClient,
} from '../utils'

const getConnectionByUserIdMock = vi.fn()

vi.mock('@/server/device-connections', () => ({
  getConnectionByUserId: (...args: unknown[]) => getConnectionByUserIdMock(...args),
}))

function createRuntimeStatusChain() {
  const devices = [{
    id: 'device-001',
    name: '测试 Desktop',
    type: 'desktop',
    online: true,
    last_heartbeat: '2026-06-02T00:00:00.000Z',
    created_at: '2026-06-01T00:00:00.000Z',
  }]
  const channels = [{
    device_id: 'device-001',
    endpoint_id: 'endpoint-001',
    status: 'connected',
    connected_at: '2026-06-02T00:00:00.000Z',
    last_heartbeat: '2026-06-02T00:01:00.000Z',
  }]
  const capabilities = [{
    capability: 'runtime_detection',
    value: JSON.stringify([{ available: true, authenticated: true, launchable: true }]),
  }]

  return vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'devices') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ data: devices, error: null }),
            }),
          }),
        }
      }
      if (table === 'device_runtime_channels') {
        return {
          select: () => ({
            eq: () => ({
              data: channels,
              error: null,
              then(resolve: (value: { data: typeof channels; error: null }) => void) {
                resolve({ data: channels, error: null })
              },
            }),
          }),
        }
      }
      if (table === 'runtime_capabilities') {
        return {
          select: () => ({
            eq: () => ({
              data: capabilities,
              error: null,
            }),
          }),
        }
      }
      return {
        select: () => ({ data: [], error: null }),
      }
    }),
  }))
}

describe('/api/runtime/status', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    setupMockAuth()
    getConnectionByUserIdMock.mockReset()
  })

  it('reports native session resume support when Desktop runtime is ready', async () => {
    const { GET } = await import('@/app/api/runtime/status/route')
    setupMockClient(createRuntimeStatusChain())
    getConnectionByUserIdMock.mockReturnValue({ deviceId: 'device-001' })

    const response = await GET()
    const data = await response.json() as {
      operable: boolean
      blockReason: string | null
      runtime: {
        status: string
        nativeSessionAvailable: boolean
        nativeSessionDescription: string
        description: string
      }
    }
    expect(response.status).toBe(200)
    expect(data.operable).toBe(true)
    expect(data.blockReason).toBeNull()
    expect(data.runtime.status).toBe('ready')
    expect(data.runtime.nativeSessionAvailable).toBe(true)
    expect(data.runtime.nativeSessionDescription).toContain('支持官方原生会话续接')
    expect(data.runtime.description).toContain('AgentHub 会记录并复用 native session id')
  })
})
