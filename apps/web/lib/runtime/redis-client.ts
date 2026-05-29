import { createClient as createRedisClient, type RedisClientType } from 'redis'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
const QUEUE_KEY = 'agenthub:runtime:queue'
const eventChannel = (id: string) => `agenthub:runtime:events:${id}`
const cancelKey = (id: string) => `agenthub:runtime:cancel:${id}`

export interface RuntimeJob {
  runtimeSessionId: string
  endpointId?: string
  prompt: string
  fail?: boolean
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

export async function* subscribeEvents(runtimeSessionId: string): AsyncGenerator<unknown> {
  const r = (await getRedis()).duplicate()
  await r.connect()
  const queue: unknown[] = []
  let resolve: (() => void) | null = null
  let done = false
  await r.subscribe(eventChannel(runtimeSessionId), (msg) => {
    const e = JSON.parse(msg) as { type?: string }
    queue.push(e)
    if (e.type === 'runtime_completed' || e.type === 'runtime_failed' || e.type === 'runtime_cancelled') done = true
    resolve?.()
  })
  try {
    while (true) {
      if (queue.length === 0) {
        if (done) break
        await new Promise<void>((res) => { resolve = res })
        resolve = null
      }
      while (queue.length > 0) yield queue.shift()
      if (done && queue.length === 0) break
    }
  } finally {
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
