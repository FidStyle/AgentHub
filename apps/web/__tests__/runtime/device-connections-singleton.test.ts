import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/runtime/redis-client', () => ({
  getRedis: async () => ({
    duplicate: () => ({
      connect: async () => {},
      subscribe: async () => {},
      unsubscribe: async () => {},
      quit: async () => {},
    }),
    publish: async () => {},
  }),
}))

describe('device-connections module state', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('shares live DeviceChannel connections across repeated module loads', async () => {
    const first = await import('../../server/device-connections')
    first.addConnection('device-1', {
      ws: { readyState: 1, send: vi.fn() } as never,
      deviceId: 'device-1',
      userId: 'user-1',
      workspaceIds: [],
      lastHeartbeat: Date.now(),
    })

    vi.resetModules()
    const second = await import('../../server/device-connections')

    expect(second.getConnectionByUserId('user-1')?.deviceId).toBe('device-1')
    expect(second.getConnection('device-1')?.userId).toBe('user-1')
  })
})
