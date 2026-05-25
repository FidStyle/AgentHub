import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'

export function WorkspaceBinding() {
  const { workspaceDirs } = useConsoleStore()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">工作区绑定</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {workspaceDirs.map((dir) => (
          <div key={dir.path} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${dir.healthy ? 'bg-success' : 'bg-destructive'}`} />
              <span className="text-xs font-mono truncate max-w-[200px]">{dir.path}</span>
            </div>
            <Badge variant={dir.healthy ? 'default' : 'destructive'}>
              {dir.healthy ? '正常' : '异常'}
            </Badge>
          </div>
        ))}
        <Button variant="outline" size="sm" className="self-start mt-1"
          onClick={() => window.open('http://localhost:3000/workspace', '_blank')}>
          打开 Web 工作台
        </Button>
      </CardContent>
    </Card>
  )
}
