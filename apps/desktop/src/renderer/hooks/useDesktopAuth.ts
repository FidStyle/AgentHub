import { useConsoleStore } from '../store/console-store'
import { checkWebServiceAvailable, getWebUrl, WEB_BASE_URL } from '../utils/web-urls'

const WEB_AUTH_URL = getWebUrl('/api/auth/signin?callbackUrl=/workspace')

export function useDesktopAuth() {
  const { setAuthError } = useConsoleStore()

  const handleGitHubLogin = async () => {
    setAuthError(null)
    const available = await checkWebServiceAvailable()
    if (!available) {
      setAuthError(`无法连接到 Web 登录服务（${WEB_BASE_URL}），请先启动 apps/web。`)
      return
    }

    try {
      window.open(WEB_AUTH_URL, '_blank', 'noopener,noreferrer')
      setAuthError(null)
    } catch {
      setAuthError('无法打开登录页面，请确认 Web 服务已启动后重试。')
    }
  }

  return { handleGitHubLogin }
}
