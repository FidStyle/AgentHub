import './globals.css'
import { DesktopMainShell } from './components/shell/DesktopMainShell'
import { useDeviceChannel } from './hooks/useDeviceChannel'

export default function App() {
  useDeviceChannel()
  return <DesktopMainShell />
}
