import type { LucideIcon } from 'lucide-react'
import { Button, type ButtonProps } from './button'
import { Tooltip } from './tooltip'
import { cn } from '../lib/utils'

export interface IconButtonProps extends Omit<ButtonProps, 'size'> {
  icon: LucideIcon
  label: string
  showTooltip?: boolean
  size?: 'default' | 'sm' | 'lg'
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
  tooltipAlign?: 'start' | 'center' | 'end'
}

const sizeMap = { default: 'icon', sm: 'icon', lg: 'icon' } as const
const iconSizeMap = { default: 'h-4 w-4', sm: 'h-3.5 w-3.5', lg: 'h-5 w-5' }

export function IconButton({
  icon: Icon,
  label,
  showTooltip = true,
  size = 'default',
  tooltipSide,
  tooltipAlign,
  className,
  ...props
}: IconButtonProps) {
  const btn = (
    <Button
      size={sizeMap[size]}
      variant="ghost"
      aria-label={label}
      className={cn(className)}
      {...props}
    >
      <Icon className={iconSizeMap[size]} />
    </Button>
  )

  if (!showTooltip) return btn
  return (
    <Tooltip content={label} side={tooltipSide} align={tooltipAlign}>
      {btn}
    </Tooltip>
  )
}
