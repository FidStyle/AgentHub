import { NextRequest } from 'next/server'
import { DEFAULT_ORCHESTRATOR_CONFIG } from '@agenthub/shared'

export async function POST(req: NextRequest) {
  const { sessionId, content } = await req.json()

  if (!sessionId || !content) {
    return Response.json({ error: 'Missing sessionId or content' }, { status: 400 })
  }

  // Orchestrator: route message, determine risk, dispatch to runtime
  const config = DEFAULT_ORCHESTRATOR_CONFIG
  const riskLevel = detectRisk(content)
  const needsApproval = config.approvalRequired(riskLevel)

  // Stream response via SSE
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const response = generateResponse(content)
      let i = 0
      const interval = setInterval(() => {
        if (i < response.length) {
          const chunk = response.slice(i, i + 3)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', content: chunk })}\n\n`))
          i += 3
        } else {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', riskLevel, needsApproval })}\n\n`))
          controller.close()
          clearInterval(interval)
        }
      }, 20)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

function detectRisk(content: string): string {
  if (/rm\s+-rf|drop\s+table|delete\s+from/i.test(content)) return 'critical'
  if (/sudo|chmod|install/i.test(content)) return 'high'
  if (/git|npm|pnpm/i.test(content)) return 'medium'
  return 'low'
}

function generateResponse(content: string): string {
  return `## 分析结果

收到您的消息：**"${content}"**

### 当前状态

我是 AgentHub Orchestrator，正在为您协调处理...

### 建议步骤

1. **分析需求** - 理解任务目标
2. **制定计划** - 拆解为可执行步骤
3. **分配任务** - 分派给合适的 Agent

\`\`\`javascript
// 示例代码
const orchestrator = {
  dispatch(task) {
    return agent.execute(task)
  }
}
\`\`\`

---
*Powered by AgentHub Orchestrator*`
}
