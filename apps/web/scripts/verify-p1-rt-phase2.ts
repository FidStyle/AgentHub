/**
 * P1-RT Phase 2 集成测试 — Desktop local runtime tunnel 接入 Cloud Runtime Gateway
 * 覆盖：
 *  1. RuntimeErrorCode 集中定义 + 字面值与 P0 契约一致（DEVICE_OFFLINE / endpoint_unavailable）
 *  2. device_runtime_channels 落库/读回：markChannelConnected → connected 行可读回；markChannelDisconnected → disconnected
 *  3. tunnel 生命周期事件闭环：
 *     - 从未连接（无 channel）→ local_runtime_offline + runtime_status=DEVICE_OFFLINE
 *     - 曾连接后断开（channel.connected_at 有值且 status=disconnected）→ tunnel_disconnected + DEVICE_OFFLINE
 *
 * 无 DATABASE_URL 时跳过需 DB 的落库/事件断言（打印 SKIP，不静默通过）；错误码一致性单元断言始终运行。
 */
export {}

import { Pool } from 'pg'
import { RuntimeErrorCode } from '@agenthub/shared'

const DATABASE_URL = process.env.DATABASE_URL

let passed = 0
let failed = 0
let skipped = 0

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  ✓ ${msg}`) }
  else { failed++; console.error(`  ✗ ${msg}`) }
}
function skip(reason: string) {
  skipped++
  console.log(`  ⊘ SKIP: ${reason}`)
}

// --- Test 1: RuntimeErrorCode 一致性（无环境依赖，始终运行）---
function testErrorCodes() {
  console.log('\n[错误码] RuntimeErrorCode 集中定义 + P0 字面值一致')
  assert(RuntimeErrorCode.DEVICE_OFFLINE === 'DEVICE_OFFLINE', 'DEVICE_OFFLINE 字面值与 P0 契约一致')
  assert(RuntimeErrorCode.ENDPOINT_UNAVAILABLE === 'endpoint_unavailable', 'ENDPOINT_UNAVAILABLE 字面值与 Phase 1 一致')
  assert(RuntimeErrorCode.TUNNEL_DISCONNECTED === 'tunnel_disconnected', 'TUNNEL_DISCONNECTED 字面值就绪')
  assert(RuntimeErrorCode.PUBLIC_RUNTIME_UNCONFIGURED === 'public_runtime_unconfigured', 'PUBLIC_RUNTIME_UNCONFIGURED 字面值就绪')
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = []
  for await (const e of gen) out.push(e)
  return out
}

function firstId(result: { rows: unknown[] }): string {
  return (result.rows[0] as { id: string }).id
}

// --- Test 2+3: 落库读回 + tunnel 事件闭环（需 DB）---
async function testChannelAndTunnel(pool: Pool) {
  const { markChannelConnected, markChannelDisconnected, getChannelByDevice } = await import('../lib/runtime/device-channel-store')
  const { invoke } = await import('../lib/runtime/gateway')

  const userId = `p2-test-user-${Date.now()}`
  await pool.query(`INSERT INTO public."user"(id, email) VALUES ($1, $2)`, [userId, `${userId}@test.local`])
  const dev = await pool.query(
    `INSERT INTO public.devices(user_id, device_token) VALUES ($1, $2) RETURNING id`,
    [userId, `tok-${userId}`],
  )
  const deviceId = firstId(dev)
  const ep = await pool.query(
    `INSERT INTO public.runtime_endpoints(user_id, kind, device_id, status) VALUES ($1,'user_local',$2,'available') RETURNING id`,
    [userId, deviceId],
  )
  const endpointId = firstId(ep)

  try {
    console.log('\n[落库] device_runtime_channels connected/disconnected 读回')
    await markChannelConnected(deviceId, endpointId)
    const c1 = await getChannelByDevice(deviceId)
    assert(c1?.status === 'connected', `markChannelConnected → status=connected (got ${c1?.status})`)
    assert(!!c1?.connected_at, 'connected 行 connected_at 有值')
    assert(c1?.endpoint_id === endpointId, 'channel 记录 endpoint_id')

    await markChannelDisconnected(deviceId)
    const c2 = await getChannelByDevice(deviceId)
    assert(c2?.status === 'disconnected', `markChannelDisconnected → status=disconnected (got ${c2?.status})`)
    assert(!!c2?.connected_at, 'disconnected 后仍保留 connected_at（用于区分曾连接）')

    console.log('\n[事件] tunnel 生命周期闭环（无 in-memory 连接）')
    // 曾连接后断开（channel 存在且 connected_at 有值）→ tunnel_disconnected
    // offline 分支不持久化 session（id='' 跳过 setSessionStatus），事件 emit 不依赖 runtime_sessions 落库
    const disconnectEvents = await collect(invoke({
      userId,
      runtimeSession: { id: '', endpoint: { id: endpointId, kind: 'user_local', status: 'available', deviceId } },
    }))
    assert(disconnectEvents.some(e => e.type === 'tunnel_disconnected'), '曾连接后断开 → emit tunnel_disconnected')
    assert(
      disconnectEvents.some(e => e.type === 'runtime_status' && (e as { status: string }).status === RuntimeErrorCode.DEVICE_OFFLINE),
      'tunnel_disconnected 仍 emit runtime_status=DEVICE_OFFLINE（P0 兼容）',
    )

    // 从未连接（无 channel）→ local_runtime_offline
    const userId2 = `p2-test-user2-${Date.now()}`
    await pool.query(`INSERT INTO public."user"(id, email) VALUES ($1, $2)`, [userId2, `${userId2}@test.local`])
    const dev2 = await pool.query(
      `INSERT INTO public.devices(user_id, device_token) VALUES ($1, $2) RETURNING id`,
      [userId2, `tok-${userId2}`],
    )
    const deviceId2 = firstId(dev2)
    const ep2 = await pool.query(
      `INSERT INTO public.runtime_endpoints(user_id, kind, device_id, status) VALUES ($1,'user_local',$2,'offline') RETURNING id`,
      [userId2, deviceId2],
    )
    const endpointId2 = firstId(ep2)
    const offlineEvents = await collect(invoke({
      userId: userId2,
      runtimeSession: { id: '', endpoint: { id: endpointId2, kind: 'user_local', status: 'offline', deviceId: deviceId2 } },
    }))
    assert(offlineEvents.some(e => e.type === 'local_runtime_offline'), '从未连接 → emit local_runtime_offline')
    assert(!offlineEvents.some(e => e.type === 'tunnel_disconnected'), '从未连接不误报 tunnel_disconnected')

    await pool.query(`DELETE FROM public."user" WHERE id = $1`, [userId2])
  } finally {
    await pool.query(`DELETE FROM public."user" WHERE id = $1`, [userId])
  }
}

async function main() {
  console.log('\n=== P1-RT Phase 2 集成测试（Desktop tunnel 接入 Gateway）===')

  testErrorCodes()

  if (!DATABASE_URL) {
    skip('DATABASE_URL 未设置 — 跳过 device_runtime_channels 落库与 tunnel 事件断言')
  } else {
    const pool = new Pool({ connectionString: DATABASE_URL })
    try {
      await testChannelAndTunnel(pool)
    } finally {
      await pool.end()
    }
  }

  const status = failed === 0 ? 'PASS' : 'FAIL'
  console.log(`\nSUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped, status=${status}`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(err => { console.error(err); process.exit(1) })
