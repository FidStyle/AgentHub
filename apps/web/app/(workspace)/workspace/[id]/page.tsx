'use client'

import { useParams } from 'next/navigation'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'

export default function WorkspaceChatPage() {
  const params = useParams<{ id: string }>()
  return <WorkspaceShell workspaceId={params.id} />
}
