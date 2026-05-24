export type DeviceType = 'desktop'

export interface Device {
  id: string
  userId: string
  type: DeviceType
  name: string
  online: boolean
  lastHeartbeat: Date
}
