import type { RoleAgentToolId } from '@agenthub/shared'
import { capabilityTagsForPrompt, toolsForPrompt } from '@/lib/role-agents/tools'

export type RoleAgentDraft = {
  workspace_id: string
  name: string
  role_type: string
  system_prompt: string
  capability_tags: string[]
  enabled_tool_ids: RoleAgentToolId[]
  runtime_type: 'claude_code' | 'codex'
  is_orchestrator: false
}

export function titleFromRoleAgentPrompt(prompt: string) {
  if (/(文档|markdown|md|说明书|需求文档|报告|docx?)/i.test(prompt)) return '文档工程师'
  if (/(前端|ui|页面|react|web)/i.test(prompt)) return '前端工程师'
  if (/(后端|api|数据库|server|runtime)/i.test(prompt)) return '后端工程师'
  if (/(测试|验收|qa|test)/i.test(prompt)) return '测试工程师'
  if (/(审查|review|代码审查)/i.test(prompt)) return '代码审查'
  if (/(ppt|演示|幻灯片|presentation)/i.test(prompt)) return '演示稿工程师'
  return '自定义 Agent'
}

export function roleTypeFromRoleAgentPrompt(prompt: string) {
  if (/(审查|review)/i.test(prompt)) return 'reviewer'
  if (/(测试|验收|qa|test)/i.test(prompt)) return 'tester'
  return 'engineer'
}

export function createRoleAgentDraft(workspaceId: string, prompt: string): RoleAgentDraft {
  const name = titleFromRoleAgentPrompt(prompt)
  const enabledToolIds = toolsForPrompt(prompt)
  const capabilityTags = capabilityTagsForPrompt(prompt)

  return {
    workspace_id: workspaceId,
    name,
    role_type: roleTypeFromRoleAgentPrompt(prompt),
    system_prompt: [
      `你是 AgentHub 中的「${name}」。`,
      `用户创建意图：${prompt}`,
      '请只在授权工具集允许的边界内执行；缺少工具集时说明需要用户调整 Agent 配置。',
    ].join('\n'),
    capability_tags: capabilityTags,
    enabled_tool_ids: enabledToolIds,
    runtime_type: enabledToolIds.includes('shell') || enabledToolIds.includes('file_write') ? 'codex' : 'claude_code',
    is_orchestrator: false,
  }
}

export function isRoleAgentCreationIntent(content: string, selectedRoleNames: string[] = []) {
  const text = content.trim()
  if (!text) return false
  if (selectedRoleNames.some((name) => name === 'Agent 创建助手')) return true
  return /(创建|新建|生成|配置|添加).{0,18}(Agent|智能体|角色|工程师|助手)/i.test(text) ||
    /(Agent|智能体|角色|工程师|助手).{0,18}(创建|新建|生成|配置|添加)/i.test(text)
}
