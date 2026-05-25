import { Loader2, AlertCircle, CheckCircle, Clock, ShieldAlert, Package, LogIn, WifiOff, UserX } from 'lucide-react'
import { Card, CardContent } from './card'
import { cn } from '../lib/utils'

type StateVariant =
  | 'empty'
  | 'loading'
  | 'error'
  | 'running'
  | 'pending-approval'
  | 'success'
  | 'runtime-not-installed'
  | 'runtime-not-logged-in'
  | 'offline'
  | 'not-logged-in'

interface StateCardProps {
  variant: StateVariant
  title?: string
  description?: string
  action?: React.ReactNode
  className?: string
}

const stateConfig: Record<StateVariant, { icon: React.ElementType; defaultTitle: string; defaultDesc: string; colorClass: string }> = {
  empty: {
    icon: Package,
    defaultTitle: '暂无数据',
    defaultDesc: '当前没有可显示的内容',
    colorClass: 'text-muted-foreground',
  },
  loading: {
    icon: Loader2,
    defaultTitle: '加载中',
    defaultDesc: '正在获取数据，请稍候',
    colorClass: 'text-info',
  },
  error: {
    icon: AlertCircle,
    defaultTitle: '加载失败',
    defaultDesc: '数据获取失败，请重试',
    colorClass: 'text-destructive',
  },
  running: {
    icon: Loader2,
    defaultTitle: '执行中',
    defaultDesc: '任务正在执行，请稍候',
    colorClass: 'text-info',
  },
  'pending-approval': {
    icon: Clock,
    defaultTitle: '待审批',
    defaultDesc: '操作需要审批后才能继续',
    colorClass: 'text-warning',
  },
  success: {
    icon: CheckCircle,
    defaultTitle: '完成',
    defaultDesc: '操作已成功完成',
    colorClass: 'text-success',
  },
  'runtime-not-installed': {
    icon: Package,
    defaultTitle: 'Runtime 未安装',
    defaultDesc: '请先安装本地 Runtime（如 Claude Code CLI），然后重新检测',
    colorClass: 'text-muted-foreground',
  },
  'runtime-not-logged-in': {
    icon: LogIn,
    defaultTitle: 'Runtime 未登录',
    defaultDesc: '请在终端中运行原生登录命令完成认证，然后重新检测',
    colorClass: 'text-warning',
  },
  offline: {
    icon: WifiOff,
    defaultTitle: '设备离线',
    defaultDesc: '桌面连接器未连接，请检查网络或重启应用',
    colorClass: 'text-muted-foreground',
  },
  'not-logged-in': {
    icon: UserX,
    defaultTitle: '未登录',
    defaultDesc: '请先登录以使用完整功能',
    colorClass: 'text-warning',
  },
}

export function StateCard({ variant, title, description, action, className }: StateCardProps) {
  const config = stateConfig[variant]
  const Icon = config.icon
  const isSpinning = variant === 'loading' || variant === 'running'

  return (
    <Card className={cn('w-full', className)} data-testid={`state-card-${variant}`}>
      <CardContent className="flex flex-col items-center justify-center py-8 text-center">
        <Icon className={cn('h-8 w-8 mb-3', config.colorClass, isSpinning && 'animate-spin')} />
        <h4 className="text-sm font-medium mb-1">{title ?? config.defaultTitle}</h4>
        <p className="text-xs text-muted-foreground max-w-[240px]">
          {description ?? config.defaultDesc}
        </p>
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  )
}

export type { StateVariant, StateCardProps }
