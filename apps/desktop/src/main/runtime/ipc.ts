import { ipcMain } from 'electron'
import { LocalRuntimeAdapter, type RuntimePromptRequest } from './local-adapter'

const adapter = new LocalRuntimeAdapter()

export function registerRuntimeIPC() {
  ipcMain.handle('runtime:execute', async (_event, request: RuntimePromptRequest, cwd: string) => {
    return adapter.execute(request, cwd)
  })

  ipcMain.handle('runtime:available', async () => {
    return adapter.isAvailable()
  })

  ipcMain.handle('runtime:type', () => adapter.type)
}
