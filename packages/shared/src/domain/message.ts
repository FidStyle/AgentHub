export type MessageType = 'text' | 'plan_card' | 'result_card' | 'approval' | 'system_event'
export type SenderType = 'user' | 'agent' | 'system'
export type StreamingStatus = 'idle' | 'streaming' | 'complete'

export interface Message {
  id: string
  session_id: string
  sender_type: SenderType
  sender_id: string | null
  role_agent_id: string | null
  content: string
  message_type: MessageType
  streaming_status: StreamingStatus
  metadata: Record<string, unknown> | null
  is_pinned: boolean
  created_at: string
  updated_at: string
}
