import type { RuntimeGatewayEvent } from '@agenthub/shared'
import { resolveEndpoint, createSession, invoke, persistRuntimeEvent } from './gateway'
import type { ExecutionDomain } from '@agenthub/shared'

export type { RuntimeGatewayEvent }

// HostedRuntimeAdapter is a Cloud Runtime Gateway client boundary — it must not hardcode a provider.
export class HostedRuntimeAdapter {
  async *invoke(input: {
    userId: string
    sessionId: string
    executionDomain: ExecutionDomain
    workspaceId: string
    userMessage?: string
    systemPrompt?: string
    roleAgentId?: string
  }): AsyncGenerator<RuntimeGatewayEvent> {
    const endpoint = await resolveEndpoint({
      userId: input.userId,
      workspaceId: input.workspaceId,
      executionDomain: input.executionDomain,
    })
    const runtimeSession = await createSession({
      sessionId: input.sessionId,
      endpoint,
      roleAgentId: input.roleAgentId,
    })

    const shouldPersistGatewayEvent = (event: RuntimeGatewayEvent): boolean => {
      if (endpoint.kind !== 'public_cloud') return true
      if (!event.type.startsWith('runtime_')) return true

      // Cloud worker owns persistence for normal runtime_* events. The gateway still persists
      // its own timeout sentinel because no worker log exists for that case.
      return event.type === 'runtime_failed' && !('endpointId' in event)
    }

    let seq = 0
    for await (const event of invoke({
      userId: input.userId,
      runtimeSession,
      userMessage: input.userMessage,
      systemPrompt: input.systemPrompt,
    })) {
      if (shouldPersistGatewayEvent(event)) {
        await persistRuntimeEvent(runtimeSession.id, event, seq++)
      }
      yield event
    }
  }
}
