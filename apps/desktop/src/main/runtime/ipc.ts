import { ipcMain } from 'electron'
import { LocalRuntimeAdapter } from './local-adapter'

const adapter = new LocalRuntimeAdapter()

export function registerRuntimeIPC() {
  ipcMain.handle('runtime:execute', async (_event, command: string, cwd: string) => {
    return adapter.execute(command, cwd)
  })

  ipcMain.handle('runtime:available', async () => {
    return adapter.isAvailable()
  })

  ipcMain.handle('runtime:type', () => adapter.type)
}
