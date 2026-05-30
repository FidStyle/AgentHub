import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/utils'

type Side = 'top' | 'bottom' | 'left' | 'right'
type Align = 'start' | 'center' | 'end'

interface TooltipProps {
  content: string
  children: React.ReactNode
  className?: string
  side?: Side
  align?: Align
}

const GAP = 6
const MARGIN = 8

function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}

function computePosition(
  trigger: DOMRect,
  tip: { width: number; height: number },
  side: Side,
  align: Align,
): { top: number; left: number; side: Side } {
  const vw = window.innerWidth
  const vh = window.innerHeight

  const fits = (s: Side) => {
    if (s === 'top') return trigger.top - GAP - tip.height >= MARGIN
    if (s === 'bottom') return trigger.bottom + GAP + tip.height <= vh - MARGIN
    if (s === 'left') return trigger.left - GAP - tip.width >= MARGIN
    return trigger.right + GAP + tip.width <= vw - MARGIN
  }
  const opposite: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }
  const resolved = fits(side) ? side : fits(opposite[side]) ? opposite[side] : side

  let top = 0
  let left = 0
  if (resolved === 'top' || resolved === 'bottom') {
    top = resolved === 'top' ? trigger.top - GAP - tip.height : trigger.bottom + GAP
    const center = trigger.left + trigger.width / 2 - tip.width / 2
    left = align === 'start' ? trigger.left : align === 'end' ? trigger.right - tip.width : center
  } else {
    left = resolved === 'left' ? trigger.left - GAP - tip.width : trigger.right + GAP
    const center = trigger.top + trigger.height / 2 - tip.height / 2
    top = align === 'start' ? trigger.top : align === 'end' ? trigger.bottom - tip.height : center
  }

  left = Math.max(MARGIN, Math.min(left, vw - tip.width - MARGIN))
  top = Math.max(MARGIN, Math.min(top, vh - tip.height - MARGIN))
  return { top, left, side: resolved }
}

export function Tooltip({ content, children, className, side = 'top', align = 'center' }: TooltipProps) {
  const mounted = useMounted()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const id = useId()

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !tipRef.current) return
    const update = () => {
      if (!triggerRef.current || !tipRef.current) return
      const t = triggerRef.current.getBoundingClientRect()
      const tip = tipRef.current
      const { top, left } = computePosition(t, { width: tip.offsetWidth, height: tip.offsetHeight }, side, align)
      setPos({ top, left })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, side, align, content])

  return (
    <span
      ref={triggerRef}
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      <TooltipContent open={mounted && open} id={id} content={content} pos={pos} tipRef={tipRef} />
    </span>
  )
}

function TooltipContent({
  open,
  id,
  content,
  pos,
  tipRef,
}: {
  open: boolean
  id: string
  content: string
  pos: { top: number; left: number } | null
  tipRef: React.RefObject<HTMLSpanElement | null>
}) {
  if (!open) return null
  return createPortal(
    <span
      ref={tipRef}
      id={id}
      role="tooltip"
      style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
      className="pointer-events-none fixed z-50 max-w-[16rem] break-words rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md"
    >
      {content}
    </span>,
    document.body,
  )
}
