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
  }): AsyncGenerator<RuntimeGatewayEvent> {
    const endpoint = await resolveEndpoint({
      userId: input.userId,
      workspaceId: input.workspaceId,
      executionDomain: input.executionDomain,
    })
    const runtimeSession = await createSession({ sessionId: input.sessionId, endpoint })

    let seq = 0
    for await (const event of invoke({ userId: input.userId, runtimeSession })) {
      await persistRuntimeEvent(runtimeSession.id, event, seq++)
      yield event
    }
  }
}
