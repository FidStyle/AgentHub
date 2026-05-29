import { getDeviceGatewayUrl } from './web-urls'
import { getElectronAPI } from './electron-api'

const DEVICE_TOKEN_STORAGE_KEY = 'agenthub.desktop.deviceToken'

export function saveDeviceToken(deviceToken: string) {
  window.localStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, deviceToken)
}

export function getSavedDeviceToken() {
  return window.localStorage.getItem(DEVICE_TOKEN_STORAGE_KEY)
}

export function clearSavedDeviceToken() {
  window.localStorage.removeItem(DEVICE_TOKEN_STORAGE_KEY)
}

export async function connectDesktopDeviceChannel(deviceToken: string) {
  const deviceChannel = getElectronAPI()?.deviceChannel
  if (!deviceChannel) return false

  saveDeviceToken(deviceToken)
  await deviceChannel.connect({
    gatewayUrl: getDeviceGatewayUrl(),
    deviceToken,
  })
  return true
}
