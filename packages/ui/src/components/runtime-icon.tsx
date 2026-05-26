import { BrandIcon, type BrandKind } from './brand-icon'
import { cn } from '../lib/utils'

export type RuntimeKind = 'claude_code' | 'codex' | 'opencode' | 'github'

export interface RuntimeIconProps {
  runtimeKind: RuntimeKind
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

const runtimeToBrand: Record<RuntimeKind, BrandKind> = {
  claude_code: 'claude-code',
  codex: 'codex',
  opencode: 'agenthub',
  github: 'github',
}

export function RuntimeIcon({ runtimeKind, size = 'default', className }: RuntimeIconProps) {
  return (
    <span data-testid={`runtime-icon-${runtimeKind}`} className={cn('inline-flex', className)}>
      <BrandIcon brand={runtimeToBrand[runtimeKind]} size={size} />
    </span>
  )
}
