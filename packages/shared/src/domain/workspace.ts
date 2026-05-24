export type ExecutionDomain = 'cloud' | 'local_desktop'

export interface Workspace {
  id: string
  name: string
  userId: string
  executionDomain: ExecutionDomain
  createdAt: Date
}
