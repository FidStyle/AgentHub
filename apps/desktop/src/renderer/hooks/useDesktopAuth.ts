import { useConsoleStore } from '../store/console-store'

const WEB_AUTH_URL = 'http://localhost:3000/api/auth/signin/github'

export function useDesktopAuth() {
  const { setAuthError } = useConsoleStore()

  const handleGitHubLogin = () => {
    try {
      const win = window.open(WEB_AUTH_URL, '_blank')
      if (!win) {
        setAuthError('浏览器阻止了弹窗，请允许弹窗后重试，或手动访问 Web 工作台登录。')
      } else {
        setAuthError(null)
      }
    } catch {
      setAuthError('无法打开登录页面，请确认 Web 服务已启动后重试。')
    }
  }

  return { handleGitHubLogin }
}
