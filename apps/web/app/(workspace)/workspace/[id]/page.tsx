'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'

export default function WorkspaceChatPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  return <WorkspaceShell workspaceId={params.id} requestedMode={searchParams.get('mode') === 'operate' ? 'operate' : 'read-only'} />
}
