import type { LucideIcon } from 'lucide-react'
import { Badge } from './badge'
import { cn } from '../lib/utils'

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: string
  tone?: StatusTone
  icon?: LucideIcon
  dot?: boolean
}

const toneToVariant: Record<StatusTone, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  neutral: 'secondary',
  info: 'default',
  success: 'success',
  warning: 'warning',
  danger: 'destructive',
}

const dotClass: Record<StatusTone, string> = {
  neutral: 'bg-muted-foreground',
  info: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
}

export function StatusPill({
  label,
  tone = 'neutral',
  icon: Icon,
  dot = false,
  className,
  ...props
}: StatusPillProps) {
  return (
    <Badge variant={toneToVariant[tone]} className={cn('gap-1.5 whitespace-nowrap', className)} {...props}>
      {dot && <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', dotClass[tone])} />}
      {Icon && <Icon aria-hidden="true" className="h-3 w-3" />}
      {label}
    </Badge>
  )
}
