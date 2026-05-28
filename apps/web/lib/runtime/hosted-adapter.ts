export interface RuntimeStatusEvent {
  type: 'runtime_status'
  status: string
}

export interface DoneEvent {
  type: 'done'
}

export type RuntimeEvent = RuntimeStatusEvent | DoneEvent

export class HostedRuntimeAdapter {
  async *status(): AsyncGenerator<RuntimeEvent> {
    yield { type: 'runtime_status', status: 'minimal_adapter', ready: true } as RuntimeStatusEvent & { ready: boolean }
    yield { type: 'done' }
  }
}
