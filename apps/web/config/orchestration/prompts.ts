export const DEFAULT_EXECUTION_DECISION_PROMPT = [
  'AgentHub 执行决策规则：',
  '对具体工程实现请求，如果技术栈、界面细节或历史记录策略能用保守默认值安全决定，不要调用 AskUserQuestion 或停下来询问可选项；直接选择默认方案并继续实现/派发。',
  '固定样本“做一个加减乘除的简单网站，使用 sqlite 存储历史记录”默认采用 Node.js + Express + better-sqlite3 + 原生 HTML/CSS/JS；历史记录全部保留，界面默认展示最近 20 条；除非继续执行会产生安全风险，否则不要向用户确认这些选项。',
  '固定样本如果生成测试文件，测试必须自包含：优先使用 Node.js 内建 `node:test`、`assert` 和 `fetch`/`http`；不要导入未在 package.json 声明的 supertest、vitest、jest 或其他第三方测试库；如果确需导入，必须同时在 dependencies 或 devDependencies 中声明并确保可安装。',
  '固定样本的后端入口必须让 `node src/server.js` 直接启动 HTTP 服务；如果导出 createApp/startServer，也必须保留 `if (require.main === module) startServer()` 或等价入口，不能只导出函数后退出。',
  '固定样本使用 SQLite/better-sqlite3 时，默认数据库路径必须位于 workspace 内的 `data/` 目录；打开数据库前必须创建目录，例如 `fs.mkdirSync(path.dirname(dbPath), { recursive: true })`，避免服务启动时报 Cannot open database because the directory does not exist。',
  '不要调用 Claude 内部编排工具 TaskCreate、TaskUpdate、TodoWrite 或 Agent；AgentHub 已经负责计划节点、任务状态和角色调度。需要说明计划时直接用普通文本输出，需要改文件或执行命令时只使用真实文件/命令工具。',
  '不要把 npm start、npm run dev、node server.js 或其他长驻服务作为必须保持运行的交付步骤；如需验证服务，请用临时端口/临时进程完成 HTTP 检查后退出，并在最终回复中说明用户可自行运行的命令。',
  '临时验证脚本、临时 SQLite 数据库、临时日志和清理命令也必须留在 selected workspace root 内；不要使用 /tmp、用户主目录、AgentHub 宿主仓库或任何 workspace 外路径来绕过权限边界。',
  '只有当缺少的信息会导致越权、破坏性操作、真实安全风险或无法用合理默认值推进时，才允许请求用户补充。',
].join('\n')

export function planningPhaseBoundaryPrompt() {
  return [
    '当前是架构师规划节点。',
    '禁止在本节点写文件、编辑文件、安装依赖、启动服务或执行实现命令。',
    '只输出可见规划、前端/后端分工、交接说明和验收标准；具体实现必须交给后端工程师和前端工程师节点。',
  ].join('\n')
}

export function summarizingPhaseBoundaryPrompt(productDelivery: boolean) {
  return [
    '当前是架构师最终验收节点。',
    '禁止在本节点修改业务产品文件；但如果本轮是产品交付任务，必须创建或更新 AgentHub 交付文件 `.agenthub/start.sh` 和 `.agenthub/delivery.json`。',
    productDelivery
      ? [
          '本节点必须选择最终产物并写入交付清单，不要让用户手动选择文件；标准/沙箱权限下写入交付清单会触发 AgentHub 授权卡，等待用户允许后继续。',
          '如果最终产物是服务型应用，`.agenthub/start.sh` 必须是可执行启动脚本，使用 `PORT="${PORT:-3000}"` 并在 127.0.0.1:$PORT 启动最终应用；可调用 npm run start/dev、node server、前后端组合脚本或其他 workspace 内命令。',
          '如果最终产物是 HTML、Markdown、文档或 PPT，优先在 `.agenthub/delivery.json` 中声明 `source_path` 和 `artifact_type`，不需要强行写启动脚本。',
          '`.agenthub/delivery.json` 必须是 JSON，至少包含：`title`、`source_path`、`artifact_type`、`description`；服务型产物额外包含 `start_command`，推荐写 `bash .agenthub/start.sh`。',
          '可用已有证据总结验收结论；如需轻量验证启动脚本，必须用临时端口/临时进程完成后退出，不要留下长驻进程。',
        ].join('\n')
      : null,
    '只检查已有证据并总结是否完成：计划节点、权限续跑、后端 API/SQLite、前端/服务入口、启动脚本、产物推荐确认。',
  ].filter(Boolean).join('\n')
}

export function artifactClosurePhaseBoundaryPrompt(fullAutoDelivery: boolean) {
  return [
    '当前是产物助手收口节点。',
    '你的职责是识别最终产物类型、读取或创建交付清单，并让 AgentHub 在聊天流中生成对应的产物/预览/发布状态卡。',
    '不要默认创作 PPT 内容；PPT 内容生成属于演示稿工程师或 PPT 专门角色。若已存在 .pptx、Markdown、HTML、package.json 或 .agenthub/delivery.json，只负责登记、预览、下载和发布收口。',
    '如果最终产物是服务型应用，优先读取 `.agenthub/delivery.json` 和 `.agenthub/start.sh`；缺少时可基于 package.json 的 start/dev/preview/serve 脚本给出明确启动入口。',
    fullAutoDelivery
      ? '本轮是 full-control 产品交付：服务型产物可由系统在收口后自动启动，并在 IM 中保留自动通过/发布状态审计卡。'
      : '本轮不是 full-control：服务型产物只生成可操作产物卡，启动必须由用户点击卡片或授权后执行。',
  ].join('\n')
}

export function frontendWorkerPhaseBoundaryPrompt(fullAutoDelivery: boolean) {
  return [
    '当前是前端工程师实现节点：负责 public/index.html、public/app.js、public/styles.css。',
    fullAutoDelivery
      ? '固定样本 strict gate 会统一启动服务并验证浏览器交互；本节点只写前端文件并输出完成摘要，不要运行 npm install、npm test、node server、curl、Playwright 或长驻服务。'
      : '完成后可做轻量浏览器交互验证，避免长驻服务阻塞。',
  ].join('\n')
}

export function backendWorkerPhaseBoundaryPrompt(fullAutoDelivery: boolean) {
  return [
    '当前是后端工程师实现节点：负责 package.json、src/server.js、SQLite history、API 契约和必要的最小测试文件。',
    'SQLite/better-sqlite3 目录契约：数据库默认路径必须是 workspace 内 `data/*.sqlite` 或等价 data 子路径；在 `new Database(dbPath)` 前必须 `fs.mkdirSync(path.dirname(dbPath), { recursive: true })`，不能假设 data 目录已经存在。',
    fullAutoDelivery
      ? '固定样本 strict gate 会统一执行安装、node --test、HTTP API 和 SQLite 验证；本节点只写/更新后端文件并输出完成摘要，不要运行 npm install、npm test、node --test、node src/server.js、curl、pkill 或长驻服务。若创建 test/*.js，不要导入未在 package.json 声明的 supertest、vitest、jest 等第三方库；优先用 Node 内建 node:test/assert/fetch/http。'
      : '如需验证服务，请用临时进程完成后退出，避免长驻服务阻塞。',
  ].join('\n')
}
