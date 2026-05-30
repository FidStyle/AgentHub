import type { RuntimeGatewayEvent } from '@agenthub/shared'

export interface RuntimeConfig {
  configured: boolean
  baseUrl: string
  sessionId: string
  token: string
  missing: string[]
}

const KEYS = {
  baseUrl: 'EXPO_PUBLIC_API_BASE_URL',
  sessionId: 'EXPO_PUBLIC_SESSION_ID',
  token: 'EXPO_PUBLIC_AUTH_TOKEN',
} as const

export function getRuntimeConfig(): RuntimeConfig {
  const env = (typeof process !== 'undefined' && process.env) || {}
  const baseUrl = (env[KEYS.baseUrl] ?? '').trim()
  const sessionId = (env[KEYS.sessionId] ?? '').trim()
  const token = (env[KEYS.token] ?? '').trim()

  const missing: string[] = []
  if (!baseUrl) missing.push(KEYS.baseUrl)
  if (!sessionId) missing.push(KEYS.sessionId)
  if (!token) missing.push(KEYS.token)

  return { configured: missing.length === 0, baseUrl, sessionId, token, missing }
}

export type { RuntimeGatewayEvent }
