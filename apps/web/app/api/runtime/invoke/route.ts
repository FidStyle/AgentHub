import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'

export async function POST() {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  return NextResponse.json({
    error: '旧本地 Runtime invoke 入口已停用，请从工作台发送消息，经 /api/chat、Runtime Gateway 和 Desktop DeviceChannel 执行。',
  }, { status: 410 })
}
