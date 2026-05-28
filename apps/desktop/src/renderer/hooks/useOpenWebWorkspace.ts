import { useState } from 'react'
import { useConsoleStore } from '../store/console-store'
import { checkWebServiceAvailable, getWebUrl } from '../utils/web-urls'

const WEB_WORKSPACE_URL = getWebUrl('/workspace')

export function useOpenWebWorkspace() {
  const [loading, setLoading] = useState(false)
  const { setWebWorkspaceError } = useConsoleStore()

  const openWebWorkspace = async () => {
    setLoading(true)
    setWebWorkspaceError(null)
    try {
      const available = await checkWebServiceAvailable()
      if (available) {
        window.open(WEB_WORKSPACE_URL, '_blank', 'noopener,noreferrer')
      } else {
        setWebWorkspaceError('无法连接到 Web 工作台，请确认 Web 服务已启动后重试。')
      }
    } catch {
      setWebWorkspaceError('无法连接到 Web 工作台，请确认 Web 服务已启动后重试。')
    } finally {
      setLoading(false)
    }
  }

  return { openWebWorkspace, loading }
}
