export type ArtifactType = 'markdown' | 'code' | 'image' | 'file' | 'preview' | 'diff' | 'action_status'

export interface Artifact {
  id: string
  messageId: string
  type: ArtifactType
  content: string
  metadata?: Record<string, unknown>
}
