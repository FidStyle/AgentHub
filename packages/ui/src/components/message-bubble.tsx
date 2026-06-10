import { cn } from '../lib/utils'

export type MessageBubbleTone = 'user' | 'agent' | 'system'

export interface MessageBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: MessageBubbleTone
}

const toneClass: Record<MessageBubbleTone, string> = {
  user: 'bg-primary text-primary-foreground',
  agent: 'bg-muted text-foreground',
  system: 'border border-border bg-muted text-foreground',
}

export function MessageBubble({
  tone = 'agent',
  className,
  ...props
}: MessageBubbleProps) {
  return (
    <div
      className={cn(
        'rounded-lg px-3 py-2 text-sm leading-5',
        toneClass[tone],
        className,
      )}
      {...props}
    />
  )
}
