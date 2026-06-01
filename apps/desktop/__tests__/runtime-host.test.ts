import { beforeEach, describe, expect, it, vi } from 'vitest'

const ipc = vi.hoisted(() => ({
  ipcMain: {
    handle: vi.fn(),
  },
}))

const localExec = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  ipcMain: ipc.ipcMain,
}))

vi.mock('../src/main/runtime/local-adapter', () => ({
  LocalRuntimeAdapter: class {
    execute = localExec
  },
}))

import { RuntimeHost } from '../src/main/runtime/runtime-host'
import type { RequestFrame } from '@agenthub/shared'

describe('RuntimeHost DeviceChannel runtime_invoke', () => {
  beforeEach(() => {
    localExec.mockReset()
    ipc.ipcMain.handle.mockReset()
  })

  it('maps runtimeType/prompt payload to LocalRuntimeAdapter and emits runtime events', async () => {
    localExec.mockResolvedValue({ exitCode: 0, stdout: 'clean final answer', stderr: '', duration: 12 })
    const requests = new Map<string, (frame: RequestFrame) => void>()
    const events: Array<{ type: string; payload: Record<string, unknown> }> = []
    const responses: Array<Record<string, unknown>> = []
    const channel = {
      onRequest: vi.fn((type: string, handler: (frame: RequestFrame) => void) => requests.set(type, handler)),
      sendEvent: vi.fn((type: string, payload: Record<string, unknown>) => events.push({ type, payload })),
      sendResponse: vi.fn((requestId: string, ok: boolean, error?: string, payload?: Record<string, unknown>) => {
        responses.push({ requestId, ok, error, payload })
      }),
    }

    const host = new RuntimeHost()
    host.setChannel(channel as never)

    requests.get('runtime_invoke')?.({
      type: 'request',
      seq: 1,
      requestId: 'req-1',
      requestType: 'runtime_invoke',
      payload: {
        sessionId: 'rs-1',
        runtimeType: 'codex',
        prompt: 'hello',
        cwd: '/tmp',
      },
    })

    await vi.waitFor(() => expect(responses.length).toBe(1))
    expect(localExec).toHaveBeenCalledWith({ runtimeType: 'codex', prompt: 'hello' }, '/tmp')
    expect(events.map((event) => event.payload.type)).toEqual(['started', 'text_delta', 'completed'])
    expect(responses[0]).toMatchObject({ requestId: 'req-1', ok: true, payload: { exitCode: 0 } })
  })
})
