const DEFAULT_WEB_BASE_URL = 'http://localhost:3000'

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, '')
}

const env = import.meta.env as Record<string, string | undefined>

export const WEB_BASE_URL = normalizeBaseUrl(
  env.VITE_APP_BASE_URL ?? env.APP_BASE_URL ?? env.VITE_WEB_BASE_URL ?? DEFAULT_WEB_BASE_URL,
)

export function getWebUrl(pathname: string) {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${WEB_BASE_URL}${path}`
}

export async function checkWebServiceAvailable() {
  try {
    await fetch(WEB_BASE_URL, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
    return true
  } catch {
    return false
  }
}
