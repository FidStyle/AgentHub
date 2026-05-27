import { useState } from 'react'
import { useConsoleStore } from '../store/console-store'

const WEB_WORKSPACE_URL = 'http://localhost:3000/workspace'

export function useOpenWebWorkspace() {
  const [loading, setLoading] = useState(false)
  const { setWebWorkspaceError } = useConsoleStore()

  const openWebWorkspace = async () => {
    setLoading(true)
    setWebWorkspaceError(null)
    try {
      const res = await fetch(WEB_WORKSPACE_URL, { method: 'HEAD', mode: 'no-cors' })
      if (res.type === 'opaque' || res.ok) {
        window.open(WEB_WORKSPACE_URL, '_blank')
      }
    } catch {
      setWebWorkspaceError('无法连接到 Web 工作台，请确认 Web 服务已启动后重试。')
    } finally {
      setLoading(false)
    }
  }

  return { openWebWorkspace, loading }
}
