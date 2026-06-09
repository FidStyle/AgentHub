export const ROLE_TYPE_LABELS: Record<string, string> = {
  orchestrator: '编排者',
  engineer: '工程师',
  reviewer: '审查者',
  tester: '测试者',
  custom: '自定义',
  general: '通用',
}

export function roleTypeLabel(role: { is_orchestrator?: boolean | null; role_type?: string | null }) {
  if (role.is_orchestrator) return '编排者'
  if (!role.role_type) return '角色智能体'
  return ROLE_TYPE_LABELS[role.role_type] ?? role.role_type
}
