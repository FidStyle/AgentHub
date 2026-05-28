import { useEffect, useRef } from 'react'
import { useConsoleStore } from '../store/console-store'
import { checkWebServiceAvailable, getWebUrl, WEB_BASE_URL } from '../utils/web-urls'

export function useDesktopAuth() {
  const { setAuthError, setUser } = useConsoleStore()
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    window.electronAPI?.auth?.onDeviceBind(async ({ code }) => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      try {
        const res = await fetch(getWebUrl(`/api/devices/bind-status?code=${code}`))
        if (res.ok) {
          const data = await res.json()
          if (data.bound && data.user) setUser(data.user)
        }
      } catch { /* deep link bind confirmation failed, polling will catch it */ }
    })
  }, [setUser])

  const handleGitHubLogin = async () => {
    setAuthError(null)
    const available = await checkWebServiceAvailable()
    if (!available) {
      setAuthError(`无法连接到 Web 登录服务（${WEB_BASE_URL}），请先启动 apps/web。`)
      return
    }

    try {
      const res = await fetch(getWebUrl('/api/devices/login-intent'), { method: 'POST' })
      if (!res.ok) {
        setAuthError('创建登录请求失败，请重试。')
        return
      }
      const { code, sign_in_url } = await res.json()
      window.open(sign_in_url, '_blank', 'noopener,noreferrer')
      pollBindStatus(code)
    } catch {
      setAuthError('无法发起登录，请确认 Web 服务已启动后重试。')
    }
  }

  const pollBindStatus = (code: string) => {
    let elapsed = 0
    pollingRef.current = setInterval(async () => {
      elapsed += 2000
      if (elapsed > 60000) {
        if (pollingRef.current) clearInterval(pollingRef.current)
        setAuthError('登录超时，请重试。')
        return
      }
      try {
        const res = await fetch(getWebUrl(`/api/devices/bind-status?code=${code}`))
        if (!res.ok) return
        const data = await res.json()
        if (data.bound && data.user) {
          if (pollingRef.current) clearInterval(pollingRef.current)
          setUser(data.user)
        }
      } catch { /* ignore polling errors */ }
    }, 2000)
  }

  return { handleGitHubLogin }
}
