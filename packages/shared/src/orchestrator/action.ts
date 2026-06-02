/** Action execution types for orchestrator (extends domain types) */
import type { RiskLevel } from '../domain/action'

export type OrchestratorActionType = 'shell' | 'file_write' | 'git_push' | 'git_stage' | 'git_unstage' | 'git_discard' | 'deploy'
export type OrchestratorActionStatus = 'pending' | 'approved' | 'rejected' | 'running' | 'completed' | 'failed'

export interface OrchestratorAction {
  id: string
  plan_node_id?: string
  session_id: string
  owner_id: string
  action_type: OrchestratorActionType
  command: string
  cwd?: string
  risk_level: RiskLevel
  status: OrchestratorActionStatus
  requires_approval: boolean
  result?: Record<string, unknown>
  approved_at?: string
  executed_at?: string
  created_at: string
}

/** Permission policy: determines if an action requires approval */
export interface PermissionPolicy {
  action_type: string
  risk_level: RiskLevel
  requires_approval: boolean
  description: string
}

export const DEFAULT_POLICIES: PermissionPolicy[] = [
  { action_type: 'shell', risk_level: 'low', requires_approval: false, description: '低风险 shell 命令' },
  { action_type: 'shell', risk_level: 'medium', requires_approval: false, description: '中风险 shell 命令' },
  { action_type: 'shell', risk_level: 'high', requires_approval: true, description: '高风险 shell 命令' },
  { action_type: 'file_write', risk_level: 'low', requires_approval: false, description: '文件写入' },
  { action_type: 'file_write', risk_level: 'high', requires_approval: true, description: '高风险文件写入' },
  { action_type: 'git_stage', risk_level: 'low', requires_approval: false, description: 'Git 暂存' },
  { action_type: 'git_unstage', risk_level: 'low', requires_approval: false, description: 'Git 取消暂存' },
  { action_type: 'git_discard', risk_level: 'high', requires_approval: true, description: '丢弃 Git 工作区改动' },
  { action_type: 'git_push', risk_level: 'medium', requires_approval: true, description: 'Git 推送' },
  { action_type: 'deploy', risk_level: 'high', requires_approval: true, description: '部署操作' },
]
