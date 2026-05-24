/** Orchestrator Plan DAG Types */

export interface PlanNode {
  id: string
  plan_id: string
  label: string
  agent_id?: string
  status: 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'skipped'
  action_type?: 'runtime_invoke' | 'action_exec' | 'human_confirm'
  action_payload?: Record<string, unknown>
  result?: Record<string, unknown>
  depends_on: string[]
  started_at?: string
  completed_at?: string
}

export interface PlanDAG {
  nodes: { id: string; label: string; depends_on: string[] }[]
  edges: { from: string; to: string }[]
}

export interface Plan {
  id: string
  session_id: string
  owner_id: string
  title: string
  status: 'draft' | 'pending_confirm' | 'running' | 'completed' | 'failed' | 'cancelled'
  dag: PlanDAG
  created_at: string
  updated_at: string
}

export type PlanStatus = Plan['status']
export type PlanNodeStatus = PlanNode['status']
