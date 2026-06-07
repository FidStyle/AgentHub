export type MessageType = 'text' | 'plan_card' | 'result_card' | 'approval' | 'system_event' | 'role_acknowledgement'
export type SenderType = 'user' | 'agent' | 'system'
export type StreamingStatus = 'idle' | 'streaming' | 'complete'
export type RuntimeMessagePart =
  | { id: string; type: 'tool'; status: 'running' | 'completed' | 'failed'; toolName: string; input?: unknown; delta?: string; result?: unknown }
  | {
    id: string
    type: 'permission'
    status: 'pending' | 'approved' | 'rejected' | 'running' | 'completed' | 'failed'
    actionId?: string
    title?: string
    description: string
    riskLevel?: string
    actionKind?: string
    workspaceRoot?: string
    cwd?: string
    targetPaths?: string[]
    commandPreview?: string
  }
  | { id: string; type: 'question'; status: 'pending'; questionId?: string; title?: string; content: string }
  | { id: string; type: 'diff'; status: 'created'; path?: string; diff: string; applicable?: boolean; applyable?: boolean; actionId?: string }
  | { id: string; type: 'artifact'; status: 'created'; artifactId?: string; artifactType: string; title: string; sourcePath?: string; contentRef?: string; previewUrl?: string; downloadUrl?: string }
  | { id: string; type: 'attachment'; status: 'created'; attachmentId?: string; name: string; mime?: string; size?: number; contentRef?: string; downloadUrl?: string }
  | { id: string; type: 'web_preview'; status: 'created' | 'unavailable'; title: string; url?: string; description?: string; iframeUrl?: string }
  | { id: string; type: 'publish_status'; status: 'pending' | 'running' | 'stopped' | 'failed'; artifactId?: string; title: string; url?: string; message?: string }

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
