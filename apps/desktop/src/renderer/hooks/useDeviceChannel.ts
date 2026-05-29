import { useEffect } from 'react'
import { useConsoleStore } from '../store/console-store'
import { connectDesktopDeviceChannel, getSavedDeviceToken } from '../utils/device-channel-client'
import { getElectronAPI } from '../utils/electron-api'

export function useDeviceChannel() {
  const setConnectionState = useConsoleStore((state) => state.setConnectionState)

  useEffect(() => {
    const deviceChannel = getElectronAPI()?.deviceChannel
    if (!deviceChannel) return

    deviceChannel.getState().then(setConnectionState).catch(() => {
      setConnectionState('disconnected')
    })

    const unsubscribe = deviceChannel.onStateChanged(setConnectionState)
    const savedDeviceToken = getSavedDeviceToken()
    if (savedDeviceToken) {
      void connectDesktopDeviceChannel(savedDeviceToken)
    }

    return () => {
      unsubscribe?.()
    }
  }, [setConnectionState])
}
