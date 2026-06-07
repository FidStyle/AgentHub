import { closeRedis, isWorkerAlive } from '@/lib/runtime/redis-client'

const timeoutMs = Number(process.env.RUNTIME_WORKER_READY_TIMEOUT_MS ?? 30_000)
const intervalMs = Number(process.env.RUNTIME_WORKER_READY_INTERVAL_MS ?? 500)

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await isWorkerAlive()) {
      console.log('=== Runtime worker ready ===')
      return
    }
    await sleep(intervalMs)
  }
  throw new Error(`Runtime worker presence key was not observed within ${timeoutMs}ms`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await closeRedis().catch(() => undefined)
  })
