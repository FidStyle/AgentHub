import type { ActivityEntry } from '../store/console-store'

export type PolicyAuditStatus = 'executed' | 'pending' | 'blocked'

export interface PolicyAuditRecord {
  id: string
  title: string
  scope: string
  source: 'Desktop'
  status: PolicyAuditStatus
  createdAt: string
  commandPreview?: string
}

export function getPolicyAuditRecords(activities: ActivityEntry[]): PolicyAuditRecord[] {
  return activities
    .filter((entry) => entry.type === 'action' || entry.type === 'authorization')
    .map((entry) => ({
      id: entry.id,
      title: entry.message,
      scope: entry.reason ?? '本机策略内执行记录',
      source: 'Desktop',
      status: entry.status === 'success' ? 'executed' : entry.status === 'pending' ? 'pending' : 'blocked',
      createdAt: entry.time,
      commandPreview: entry.type === 'action' ? entry.message : undefined,
    }))
}
