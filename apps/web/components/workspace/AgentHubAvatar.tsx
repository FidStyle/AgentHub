import { UsersRound } from 'lucide-react'

const PALETTE = [
  'bg-[#111827] text-white',
  'bg-[#173B57] text-white',
  'bg-[#19624A] text-white',
  'bg-[#7A2E2E] text-white',
  'bg-[#5B3A86] text-white',
  'bg-[#6B4E16] text-white',
]

function hash(input: string) {
  let value = 0
  for (let index = 0; index < input.length; index += 1) {
    value = (value * 31 + input.charCodeAt(index)) >>> 0
  }
  return value
}

export function AgentHubAvatar({
  name,
  id,
  group = false,
  size = 'md',
  className = '',
}: {
  name: string
  id?: string | null
  group?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const seed = id || name || 'agenthub'
  const color = PALETTE[hash(seed) % PALETTE.length]
  const sizeClass = size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const markSize = size === 'lg' ? 'h-7 w-7' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <span
      data-testid="agenthub-avatar"
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full shadow-sm ring-1 ring-black/5 ${sizeClass} ${color} ${className}`}
      aria-hidden="true"
    >
      {group ? (
        <UsersRound className={markSize} />
      ) : (
        <svg viewBox="0 0 40 40" className={markSize} role="img">
          <path d="M9 25.5 16.4 7h15.2l-7.2 12h7.2L15.2 34l4.2-8.5H9Z" fill="currentColor" opacity="0.96" />
          <circle cx="23.5" cy="14" r="2.1" fill="white" opacity="0.92" />
          <path d="M12 25.5h12.5l-2.3 4.6H10.2L12 25.5Z" fill="#FF4D2E" />
        </svg>
      )}
    </span>
  )
}
