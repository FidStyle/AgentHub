/** Notification types */

export type NotificationType = 'approval_required' | 'plan_completed' | 'action_failed' | 'info'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body?: string
  ref_type?: 'plan' | 'action' | 'plan_node'
  ref_id?: string
  read: boolean
  created_at: string
}
