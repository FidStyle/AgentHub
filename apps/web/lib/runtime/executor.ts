export interface ExecutorChunk {
  delta: string
}

export interface ExecutorJob {
  prompt: string
  fail?: boolean
}

export interface RuntimeExecutor {
  execute(job: ExecutorJob): AsyncIterable<ExecutorChunk>
}

// FakeExecutor: echoes the prompt as space-delimited streamed chunks. No paid API, no real CLI spawn.
// job.fail injects a mid-stream failure to exercise the failure path.
export class FakeExecutor implements RuntimeExecutor {
  async *execute(job: ExecutorJob): AsyncIterable<ExecutorChunk> {
    const words = job.prompt.trim().split(/\s+/).filter(Boolean)
    const tokens = words.length > 0 ? words : ['echo']
    for (let i = 0; i < tokens.length; i++) {
      if (job.fail && i === Math.floor(tokens.length / 2)) {
        throw new Error('FakeExecutor injected failure')
      }
      yield { delta: i === 0 ? tokens[i] : ` ${tokens[i]}` }
    }
  }
}
