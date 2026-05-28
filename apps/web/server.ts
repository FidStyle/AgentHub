import { createServer } from 'http'
import { existsSync, readFileSync } from 'fs'
import next from 'next'
import path from 'path'
import { ProxyAgent, setGlobalDispatcher } from 'undici'
import { setupWebSocketGateway } from './server/ws-gateway'

function loadRootEnvLocal() {
  const envPath = path.resolve(process.cwd(), '../../.env.local')
  if (!existsSync(envPath)) return

  const content = readFileSync(envPath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eq = trimmed.indexOf('=')
    if (eq === -1) continue

    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

loadRootEnvLocal()

process.env.AUTH_URL ??= process.env.APP_BASE_URL
process.env.NEXTAUTH_URL ??= process.env.APP_BASE_URL

const outboundProxy =
  process.env.HTTPS_PROXY ??
  process.env.https_proxy ??
  process.env.ALL_PROXY ??
  process.env.all_proxy

if (outboundProxy) {
  setGlobalDispatcher(new ProxyAgent(outboundProxy))
  console.log(`> Outbound HTTPS proxy enabled: ${outboundProxy}`)
}

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res)
  })

  setupWebSocketGateway(server)

  const port = parseInt(process.env.PORT || '3000', 10)
  server.listen(port, () => {
    console.log(`> AgentHub Web 服务已启动: http://localhost:${port}`)
    console.log(`> WebSocket Device Gateway: ws://localhost:${port}/ws/device`)
  })
})
