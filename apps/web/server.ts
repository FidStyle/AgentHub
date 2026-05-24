import { createServer } from 'http'
import next from 'next'
import { setupWebSocketGateway } from './server/ws-gateway'

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
