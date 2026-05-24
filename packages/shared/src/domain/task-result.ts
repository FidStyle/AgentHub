export type TaskResultStatus = 'success' | 'partial' | 'failed'

export interface TaskResult {
  id: string
  planNodeId: string
  roleAgentId: string
  status: TaskResultStatus
  summary: string
  changedFiles: string[]
  diffUrl?: string
  previewUrl?: string
}
