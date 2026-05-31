import { useEffect } from 'react'
import { useConsoleStore } from '../store/console-store'
import { connectDesktopDeviceChannel, getSavedDeviceToken } from '../utils/device-channel-client'
import { getElectronAPI, getRuntimeApi } from '../utils/electron-api'

export function useDeviceChannel() {
  const setConnectionState = useConsoleStore((state) => state.setConnectionState)
  const setRuntimes = useConsoleStore((state) => state.setRuntimes)

  useEffect(() => {
    const deviceChannel = getElectronAPI()?.deviceChannel
    if (!deviceChannel) return

    deviceChannel.getState().then(setConnectionState).catch(() => {
      setConnectionState('disconnected')
    })

    const onStateChanged = (state: string) => {
      setConnectionState(state)
      if (state === 'connected') {
        getRuntimeApi()?.detect().then(setRuntimes).catch(() => undefined)
      }
    }
    const unsubscribe = deviceChannel.onStateChanged(onStateChanged)
    const savedDeviceToken = getSavedDeviceToken()
    if (savedDeviceToken) {
      void connectDesktopDeviceChannel(savedDeviceToken)
    }

    return () => {
      unsubscribe?.()
    }
  }, [setConnectionState])
}
