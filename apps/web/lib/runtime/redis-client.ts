import { createClient as createRedisClient, type RedisClientType } from 'redis'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
const QUEUE_KEY = 'agenthub:runtime:queue'
const eventChannel = (id: string) => `agenthub:runtime:events:${id}`
const cancelKey = (id: string) => `agenthub:runtime:cancel:${id}`
const heartbeatKey = (id: string) => `agenthub:runtime:hb:${id}`
const workerAliveKey = 'agenthub:runtime:worker:alive'

// subscribeEvents dual-timeout (env-configurable, with defaults). idle = max gap
// between two events; total = absolute lifetime of one subscription. Either tripping
// makes the generator emit a runtime_failed sentinel and return cleanly.
const SUB_IDLE_TIMEOUT_MS = Number(process.env.RUNTIME_SUB_IDLE_TIMEOUT_MS ?? 60_000)
const SUB_TOTAL_TIMEOUT_MS = Number(process.env.RUNTIME_SUB_TOTAL_TIMEOUT_MS ?? 600_000)

export interface RuntimeJob {
  runtimeSessionId: string
  workspaceId?: string
  sessionId?: string
  ownerId?: string
  workspaceRoot?: string | null
  endpointId?: string
  runtimeType?: 'claude_code' | 'codex'
  roleAgentId?: string | null
  nativeSessionId?: string | null
  cwd?: string | null
  prompt: string
  systemPrompt?: string
  fail?: boolean
  actionId?: string
  actionResult?: Record<string, unknown> | null
  approvedNativeTool?: {
    toolCallId?: string | null
    toolName: string
    actionKind: string
    targetPaths?: string[]
    executed: boolean
    output?: string
    error?: string
  } | null
  planNodeId?: string
  attemptId?: string
  mailboxItemId?: string | null
  suppressPlanProgress?: boolean
}

let client: RedisClientType | null = null

export async function getRedis(): Promise<RedisClientType> {
  if (client?.isReady) return client
  client = createRedisClient({ url: REDIS_URL })
  await client.connect()
  return client
}

export async function closeRedis(): Promise<void> {
  if (client?.isOpen) await client.quit()
  client = null
}

export async function enqueue(job: RuntimeJob): Promise<void> {
  const r = await getRedis()
  await r.lPush(QUEUE_KEY, JSON.stringify(job))
}

export async function dequeue(timeoutSec = 0): Promise<RuntimeJob | null> {
  const r = await getRedis()
  const res = await r.brPop(QUEUE_KEY, timeoutSec)
  return res ? (JSON.parse(res.element) as RuntimeJob) : null
}

export async function publishEvent(runtimeSessionId: string, event: unknown): Promise<void> {
  const r = await getRedis()
  await r.publish(eventChannel(runtimeSessionId), JSON.stringify(event))
}

export async function* subscribeEvents(
  runtimeSessionId: string,
  onSubscribed?: () => Promise<void>,
): AsyncGenerator<unknown> {
  const r = (await getRedis()).duplicate()
  await r.connect()
  const queue: unknown[] = []
  let resolve: (() => void) | null = null
  let done = false
  let timedOut = false
  const wake = () => { resolve?.(); resolve = null }
  await r.subscribe(eventChannel(runtimeSessionId), (msg) => {
    const e = JSON.parse(msg) as { type?: string }
    queue.push(e)
    if (e.type === 'runtime_completed' || e.type === 'runtime_failed' || e.type === 'runtime_cancelled') done = true
    wake()
  })
  await onSubscribed?.()

  const totalDeadline = Date.now() + SUB_TOTAL_TIMEOUT_MS
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let totalTimer: ReturnType<typeof setTimeout> | null = null
  const clearTimers = () => {
    if (idleTimer) clearTimeout(idleTimer)
    if (totalTimer) clearTimeout(totalTimer)
    idleTimer = totalTimer = null
  }
  const trip = () => { timedOut = true; done = true; wake() }
  const armIdle = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(trip, SUB_IDLE_TIMEOUT_MS)
  }
  totalTimer = setTimeout(trip, Math.max(0, totalDeadline - Date.now()))

  try {
    while (true) {
      if (queue.length === 0) {
        if (done) break
        armIdle()
        await new Promise<void>((res) => { resolve = res })
      }
      while (queue.length > 0) {
        armIdle()
        yield queue.shift()
      }
      if (done && queue.length === 0) break
    }
    if (timedOut) {
      yield { type: 'runtime_failed', error: 'subscription timeout' }
    }
  } finally {
    clearTimers()
    await r.unsubscribe(eventChannel(runtimeSessionId))
    await r.quit()
  }
}

export async function setCancel(runtimeSessionId: string): Promise<void> {
  const r = await getRedis()
  await r.set(cancelKey(runtimeSessionId), '1', { EX: 300 })
}

export async function isCancelled(runtimeSessionId: string): Promise<boolean> {
  const r = await getRedis()
  return (await r.get(cancelKey(runtimeSessionId))) === '1'
}

export async function clearCancel(runtimeSessionId: string): Promise<void> {
  const r = await getRedis()
  await r.del(cancelKey(runtimeSessionId))
}

// Liveness heartbeat: worker refreshes a short-TTL key while a session runs.
// A missing key on a session still marked running means the worker died — the
// session must be reclaimed as failed rather than left hanging.
export async function setHeartbeat(runtimeSessionId: string, ttlSec = 30): Promise<void> {
  if (!runtimeSessionId) return
  const r = await getRedis()
  await r.set(heartbeatKey(runtimeSessionId), String(Date.now()), { EX: ttlSec })
}

export async function isAlive(runtimeSessionId: string): Promise<boolean> {
  if (!runtimeSessionId) return false
  const r = await getRedis()
  return (await r.exists(heartbeatKey(runtimeSessionId))) === 1
}

export async function clearHeartbeat(runtimeSessionId: string): Promise<void> {
  if (!runtimeSessionId) return
  const r = await getRedis()
  await r.del(heartbeatKey(runtimeSessionId))
}

// Worker presence: a running worker refreshes a short-TTL global key each loop. The gateway checks
// it before enqueueing — a missing key means no consumer is alive, so the request must short-circuit
// to an explicit error instead of enqueueing a job that would hang until the idle timeout.
export async function setWorkerAlive(
  ttlSec = Number(process.env.RUNTIME_WORKER_PRESENCE_TTL_SEC ?? 15),
): Promise<void> {
  const r = await getRedis()
  await r.set(workerAliveKey, String(Date.now()), { EX: ttlSec })
}

export async function isWorkerAlive(): Promise<boolean> {
  const r = await getRedis()
  return (await r.exists(workerAliveKey)) === 1
}

export async function clearWorkerAlive(): Promise<void> {
  const r = await getRedis()
  await r.del(workerAliveKey)
}
