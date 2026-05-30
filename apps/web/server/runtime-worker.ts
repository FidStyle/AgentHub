import { createClient } from '../lib/app-db-client'
import { CliRuntimeExecutor, FakeExecutor, ScriptedRealExecutor, type CliRuntimeType, type RuntimeExecutor } from '../lib/runtime/executor'
import { dequeue, publishEvent, isCancelled, setHeartbeat, isAlive, clearHeartbeat, setWorkerAlive, clearWorkerAlive, type RuntimeJob } from '../lib/runtime/redis-client'
import { redact } from '../lib/runtime/redact'

const HEARTBEAT_TTL_SEC = Number(process.env.RUNTIME_HEARTBEAT_TTL_SEC ?? 30)

// Selects the executor from env. Default is FakeExecutor so existing gateway tests and local runs
// need no real CLI. RUNTIME_EXECUTOR=real opts into the pluggable CLI executor; =script uses the
// deterministic non-echo ScriptedRealExecutor for delivery-path validation without a paid CLI.
export function createExecutor(): RuntimeExecutor {
  if (process.env.RUNTIME_EXECUTOR === 'real') {
    const runtimeType: CliRuntimeType = process.env.RUNTIME_CLI === 'codex' ? 'codex' : 'claude_code'
    return new CliRuntimeExecutor({ runtimeType, cwd: process.env.RUNTIME_CWD })
  }
  if (process.env.RUNTIME_EXECUTOR === 'script') return new ScriptedRealExecutor()
  return new FakeExecutor()
}

type Terminal = 'completed' | 'cancelled' | 'failed'

async function setStatus(runtimeSessionId: string, status: string, terminal = false): Promise<void> {
  if (!runtimeSessionId) return
  const db = await createClient()
  const patch: Record<string, unknown> = { status }
  if (status === 'running') patch.started_at = new Date().toISOString()
  if (terminal) patch.completed_at = new Date().toISOString()
  await db.from('runtime_sessions').update(patch).eq('id', runtimeSessionId)
}

async function log(runtimeSessionId: string, eventType: string, payload: Record<string, unknown>, seq: number): Promise<void> {
  if (!runtimeSessionId) return
  const db = await createClient()
  await db.from('runtime_logs').insert({ runtime_session_id: runtimeSessionId, event_type: eventType, payload: redact(payload), seq })
}

// Single job lifecycle: running → stream chunks (cancellable) → completed/cancelled/failed.
// Each step persists to runtime_logs (seq) + publishes to redis for gateway relay. Exported for tests.
export async function processJob(job: RuntimeJob, executor: RuntimeExecutor = new FakeExecutor()): Promise<Terminal> {
  const id = job.runtimeSessionId
  let seq = 0
  const emit = async (event: Record<string, unknown>) => {
    await log(id, String(event.type), event, seq++)
    await publishEvent(id, event)
  }

  await setStatus(id, 'running')
  await setHeartbeat(id, HEARTBEAT_TTL_SEC)
  await emit({ type: 'runtime_status', status: 'running', endpointId: job.endpointId })

  try {
    // Prepend the role's system prompt (when present) so the executor runs with the role persona.
    // Absent systemPrompt keeps the prompt unchanged — no behaviour change for existing jobs.
    const prompt = job.systemPrompt ? `${job.systemPrompt}\n\n${job.prompt}` : job.prompt
    for await (const chunk of executor.execute({ prompt, fail: job.fail })) {
      if (await isCancelled(id)) {
        await setStatus(id, 'cancelled', true)
        await clearHeartbeat(id)
        await emit({ type: 'runtime_cancelled', endpointId: job.endpointId, reason: 'cancelled by request' })
        return 'cancelled'
      }
      await setHeartbeat(id, HEARTBEAT_TTL_SEC)
      await emit({ type: 'runtime_output', delta: chunk.delta, endpointId: job.endpointId })
    }
  } catch (err) {
    await setStatus(id, 'failed', true)
    await clearHeartbeat(id)
    await emit({ type: 'runtime_failed', endpointId: job.endpointId, error: err instanceof Error ? err.message : String(err) })
    return 'failed'
  }

  await setStatus(id, 'completed', true)
  await clearHeartbeat(id)
  await emit({ type: 'runtime_completed', endpointId: job.endpointId, summary: 'done' })
  return 'completed'
}

// Liveness reclaim: when a session is still marked running but its heartbeat key
// has expired, the owning worker is gone. Reclaim it as failed + emit runtime_failed
// so consumers see a terminal event instead of hanging. Returns true when reclaimed.
export async function reclaimDeadSession(runtimeSessionId: string, endpointId?: string, seq = 0): Promise<boolean> {
  if (!runtimeSessionId) return false
  if (await isAlive(runtimeSessionId)) return false
  await setStatus(runtimeSessionId, 'failed', true)
  await clearHeartbeat(runtimeSessionId)
  const event = { type: 'runtime_failed', endpointId, error: 'liveness lost: worker heartbeat expired' }
  await log(runtimeSessionId, event.type, event, seq)
  await publishEvent(runtimeSessionId, event)
  return true
}

async function main(): Promise<void> {
  console.log('[runtime-worker] started, consuming queue...')
  const executor = createExecutor()
  const shutdown = async () => {
    await clearWorkerAlive().catch(() => {})
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
  while (true) {
    // Refresh the global presence key each loop (interval 5s < TTL 15s) so the gateway can tell a
    // live worker from none before enqueueing.
    await setWorkerAlive()
    const job = await dequeue(5)
    if (!job) continue
    try {
      await processJob(job, executor)
    } catch (err) {
      console.error('[runtime-worker] job error', err)
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('runtime-worker.ts')) {
  void main()
}
