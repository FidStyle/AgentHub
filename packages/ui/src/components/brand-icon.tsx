import { cn } from '../lib/utils'

export type BrandKind = 'github' | 'codex' | 'claude-code' | 'agenthub'

export interface BrandIconProps extends React.SVGAttributes<SVGSVGElement> {
  brand: BrandKind
  size?: 'sm' | 'default' | 'lg'
}

const sizeMap = { sm: 'h-4 w-4', default: 'h-5 w-5', lg: 'h-6 w-6' }

const labels: Record<BrandKind, string> = {
  github: 'GitHub 图标',
  codex: 'Codex 图标',
  'claude-code': 'Claude Code 图标',
  agenthub: 'AgentHub 图标',
}

function GitHubSvg() {
  return (
    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.337-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" fillRule="evenodd" clipRule="evenodd" />
  )
}

function CodexSvg() {
  return (
    <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm0 2.18L18.36 7.5 12 10.82 5.64 7.5 12 4.18zM5 9.06l6 3.33v6.55l-6-3.33V9.06zm8 9.88v-6.55l6-3.33v6.55l-6 3.33z" />
  )
}

function ClaudeCodeSvg() {
  return (
    <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.5 5.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM9 11h6v1.5H9V11zm0 3h6v1.5H9V14z" />
  )
}

function AgentHubSvg() {
  return (
    <path d="M12 2L4 6v4c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4zm0 2.18L18 7.25v2.75c0 4.52-3.13 8.72-6 9.93-2.87-1.21-6-5.41-6-9.93V7.25L12 4.18z" />
  )
}

const svgMap: Record<BrandKind, () => React.ReactNode> = {
  github: GitHubSvg,
  codex: CodexSvg,
  'claude-code': ClaudeCodeSvg,
  agenthub: AgentHubSvg,
}

export function BrandIcon({ brand, size = 'default', className, ...props }: BrandIconProps) {
  const SvgContent = svgMap[brand]
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-label={labels[brand]}
      data-testid={`brand-icon-${brand}`}
      className={cn(sizeMap[size], className)}
      {...props}
    >
      <SvgContent />
    </svg>
  )
}
