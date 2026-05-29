import { useEffect, useRef } from 'react'
import { useConsoleStore } from '../store/console-store'
import { clearSavedDeviceToken, connectDesktopDeviceChannel } from '../utils/device-channel-client'
import { checkWebServiceAvailable, getWebUrl, WEB_BASE_URL } from '../utils/web-urls'

type BindStatusResponse = {
  bound: boolean
  user?: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }
  device?: {
    id: string
    name: string
    type: string
    online: boolean
    device_token: string
    created_at: string
  }
}

export function useDesktopAuth() {
  const { setAuthError, setUser } = useConsoleStore()
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const confirmBindStatus = async (code: string) => {
    const res = await fetch(getWebUrl(`/api/devices/bind-status?code=${encodeURIComponent(code)}`))
    if (!res.ok) return false

    const data = await res.json() as BindStatusResponse
    if (data.bound && data.user) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      setUser(data.user)
      setAuthError(null)
      if (data.device?.device_token) {
        await connectDesktopDeviceChannel(data.device.device_token)
      }
      return true
    }

    return false
  }

  useEffect(() => {
    const unsubscribe = window.electronAPI?.auth?.onDeviceBind(async ({ code }) => {
      try {
        await confirmBindStatus(code)
      } catch {
        pollBindStatus(code)
      }
    })
    return () => { unsubscribe?.() }
  }, [setUser, setAuthError])

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

  const handleLogout = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setUser(null)
    setAuthError(null)
    clearSavedDeviceToken()
    void window.electronAPI?.deviceChannel?.disconnect()
  }

  const pollBindStatus = (code: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    let elapsed = 0
    pollingRef.current = setInterval(async () => {
      elapsed += 2000
      if (elapsed > 60000) {
        if (pollingRef.current) clearInterval(pollingRef.current)
        setAuthError('登录超时，请重试。')
        return
      }
      try {
        await confirmBindStatus(code)
      } catch { /* ignore polling errors */ }
    }, 2000)
  }

  return { handleGitHubLogin, handleLogout }
}
