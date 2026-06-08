import { describe, it, expect, vi, beforeEach } from 'vitest'

// Drive the real subscribeEvents generator against a controllable fake redis client.
// The fake lets a test decide whether/when a message ever arrives, so we can force
// the idle/total timeout path without a live broker.
type SubCb = (msg: string) => void
const subscribers = new Map<string, SubCb>()
let unsubscribed = false
let quit = false
const sets: Array<{ key: string; value: string; options?: unknown }> = []

function makeClient() {
  const client: Record<string, unknown> = {
    isReady: true,
    isOpen: true,
    connect: async () => {},
    quit: async () => { quit = true },
    duplicate: () => makeClient(),
    subscribe: async (channel: string, cb: SubCb) => { subscribers.set(channel, cb) },
    unsubscribe: async () => { unsubscribed = true },
    publish: async () => {},
    lPush: async () => {},
    brPop: async () => null,
    set: async (key: string, value: string, options?: unknown) => { sets.push({ key, value, options }) },
    get: async () => null,
    del: async () => {},
    exists: async () => 0,
  }
  return client
}

vi.mock('redis', () => ({
  createClient: () => makeClient(),
}))

// Emit a message into a channel from the test (channel id is the runtimeSessionId).
function emit(id: string, event: Record<string, unknown>) {
  const cb = subscribers.get(`agenthub:runtime:events:${id}`)
  cb?.(JSON.stringify(event))
}

beforeEach(() => {
  subscribers.clear()
  unsubscribed = false
  quit = false
  sets.length = 0
  process.env.REDIS_URL = 'redis://localhost:6379'
  delete process.env.RUNTIME_SUB_PROGRESS_TIMEOUT_MS
})

describe('subscribeEvents — dual timeout', () => {
  it('emits runtime_failed(subscription timeout) and returns when no terminal event arrives', async () => {
    process.env.RUNTIME_SUB_IDLE_TIMEOUT_MS = '30'
    process.env.RUNTIME_SUB_TOTAL_TIMEOUT_MS = '200'
    vi.resetModules()
    const { subscribeEvents } = await import('../../lib/runtime/redis-client')

    const events: Array<{ type?: string; error?: string }> = []
    for await (const e of subscribeEvents('to1') as AsyncGenerator<{ type?: string; error?: string }>) {
      events.push(e)
    }
    const failed = events.find((e) => e.type === 'runtime_failed')
    expect(failed).toBeDefined()
    expect(failed!.error).toBe('subscription timeout')
    // Generator exited cleanly: subscription released, connection closed.
    expect(unsubscribed).toBe(true)
    expect(quit).toBe(true)
  })

  it('does not trip the timeout when a terminal event arrives first', async () => {
    process.env.RUNTIME_SUB_IDLE_TIMEOUT_MS = '500'
    process.env.RUNTIME_SUB_TOTAL_TIMEOUT_MS = '1000'
    vi.resetModules()
    const { subscribeEvents } = await import('../../lib/runtime/redis-client')

    const events: Array<{ type?: string }> = []
    const gen = subscribeEvents('ok1') as AsyncGenerator<{ type?: string }>
    // Deliver events only after the generator has registered its subscriber
    // (subscribeEvents awaits connect() before subscribe()).
    void (async () => {
      while (!subscribers.has('agenthub:runtime:events:ok1')) {
        await new Promise((r) => setTimeout(r, 1))
      }
      emit('ok1', { type: 'runtime_output', delta: 'hi' })
      emit('ok1', { type: 'runtime_completed', summary: 'done' })
    })()
    for await (const e of gen) events.push(e)

    expect(events.some((e) => e.type === 'runtime_completed')).toBe(true)
    expect(events.some((e) => e.type === 'runtime_failed')).toBe(false)
  })

  it('treats runtime_waiting as a terminal subscription boundary without failure', async () => {
    process.env.RUNTIME_SUB_IDLE_TIMEOUT_MS = '500'
    process.env.RUNTIME_SUB_TOTAL_TIMEOUT_MS = '1000'
    vi.resetModules()
    const { subscribeEvents } = await import('../../lib/runtime/redis-client')

    const events: Array<{ type?: string; reason?: string }> = []
    const gen = subscribeEvents('wait1') as AsyncGenerator<{ type?: string; reason?: string }>
    void (async () => {
      while (!subscribers.has('agenthub:runtime:events:wait1')) {
        await new Promise((r) => setTimeout(r, 1))
      }
      emit('wait1', { type: 'approval_requested', actionId: 'action-1', description: '写入文件' })
      emit('wait1', { type: 'runtime_waiting', reason: 'Runtime 工具已进入权限审批，未执行该操作。', waitingFor: 'approval' })
    })()
    for await (const e of gen) events.push(e)

    expect(events.some((e) => e.type === 'runtime_waiting')).toBe(true)
    expect(events.some((e) => e.type === 'runtime_failed')).toBe(false)
  })

  it('treats runtime_status heartbeats as non-progress and cancels the stalled runtime', async () => {
    process.env.RUNTIME_SUB_IDLE_TIMEOUT_MS = '500'
    process.env.RUNTIME_SUB_PROGRESS_TIMEOUT_MS = '35'
    process.env.RUNTIME_SUB_TOTAL_TIMEOUT_MS = '1000'
    vi.resetModules()
    const { subscribeEvents } = await import('../../lib/runtime/redis-client')

    const events: Array<{ type?: string; error?: string }> = []
    const gen = subscribeEvents('heartbeat-only') as AsyncGenerator<{ type?: string; error?: string }>
    void (async () => {
      while (!subscribers.has('agenthub:runtime:events:heartbeat-only')) {
        await new Promise((r) => setTimeout(r, 1))
      }
      emit('heartbeat-only', { type: 'runtime_status', status: 'running' })
      await new Promise((r) => setTimeout(r, 10))
      emit('heartbeat-only', { type: 'runtime_status', status: 'running' })
    })()
    for await (const e of gen) events.push(e)

    const failed = events.find((e) => e.type === 'runtime_failed')
    expect(failed?.error).toBe('runtime progress timeout')
    expect(sets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'agenthub:runtime:cancel:heartbeat-only',
        value: '1',
      }),
    ]))
  })
})
