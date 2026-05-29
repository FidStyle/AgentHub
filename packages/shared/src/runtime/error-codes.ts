export const RuntimeErrorCode = {
  DEVICE_OFFLINE: 'DEVICE_OFFLINE',
  ENDPOINT_UNAVAILABLE: 'endpoint_unavailable',
  PUBLIC_RUNTIME_UNCONFIGURED: 'public_runtime_unconfigured',
  TUNNEL_DISCONNECTED: 'tunnel_disconnected',
} as const

export type RuntimeErrorCode = (typeof RuntimeErrorCode)[keyof typeof RuntimeErrorCode]
