import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { capabilityTagsForPrompt, toolsForPrompt } from '@/lib/role-agents/tools'
import { NextResponse } from 'next/server'

function titleFromPrompt(prompt: string) {
  if (/(前端|ui|页面|react|web)/i.test(prompt)) return '前端工程师'
  if (/(后端|api|数据库|server|runtime)/i.test(prompt)) return '后端工程师'
  if (/(测试|验收|qa|test)/i.test(prompt)) return '测试工程师'
  if (/(审查|review|代码审查)/i.test(prompt)) return '代码审查'
  if (/(ppt|演示|幻灯片|presentation)/i.test(prompt)) return '演示稿助手'
  return '自定义 Agent'
}

function roleTypeFromPrompt(prompt: string) {
  if (/(审查|review)/i.test(prompt)) return 'reviewer'
  if (/(测试|验收|qa|test)/i.test(prompt)) return 'tester'
  return 'engineer'
}

export async function POST(request: Request) {
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : ''
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!workspaceId) return NextResponse.json({ error: '缺少 workspace_id' }, { status: 400 })
  if (!prompt) return NextResponse.json({ error: '缺少 prompt' }, { status: 400 })

  const { data: ws } = await db
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', user.id)
    .single()
  if (!ws) return NextResponse.json({ error: '无权限' }, { status: 403 })

  const name = titleFromPrompt(prompt)
  const enabledToolIds = toolsForPrompt(prompt)
  const capabilityTags = capabilityTagsForPrompt(prompt)

  return NextResponse.json({
    workspace_id: workspaceId,
    name,
    role_type: roleTypeFromPrompt(prompt),
    system_prompt: [
      `你是 AgentHub 中的「${name}」。`,
      `用户创建意图：${prompt}`,
      '请只在授权工具集允许的边界内执行；缺少工具集时说明需要用户调整 Agent 配置。',
    ].join('\n'),
    capability_tags: capabilityTags,
    enabled_tool_ids: enabledToolIds,
    runtime_type: enabledToolIds.includes('shell') || enabledToolIds.includes('file_write') ? 'codex' : 'claude_code',
    is_orchestrator: false,
  })
}
