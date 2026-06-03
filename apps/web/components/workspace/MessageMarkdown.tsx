'use client'

import React, { useMemo } from 'react'
import { Check, Copy } from 'lucide-react'
import { Streamdown, type StreamdownTranslations } from 'streamdown'
import { IconButton } from '@agenthub/ui'
import { normalizeMessageMarkdown } from '@/lib/chat/markdown'

const STREAMDOWN_TRANSLATIONS: Partial<StreamdownTranslations> = {
  close: '关闭',
  copied: '已复制',
  copyCode: '复制代码',
  copyLink: '复制链接',
  copyTable: '复制表格',
  copyTableAsCsv: '复制为 CSV',
  copyTableAsMarkdown: '复制为 Markdown',
  copyTableAsTsv: '复制为 TSV',
  downloadDiagram: '下载图表',
  downloadDiagramAsMmd: '下载为 Mermaid',
  downloadDiagramAsPng: '下载为 PNG',
  downloadDiagramAsSvg: '下载为 SVG',
  downloadFile: '下载文件',
  downloadImage: '下载图片',
  downloadTable: '下载表格',
  downloadTableAsCsv: '下载为 CSV',
  downloadTableAsMarkdown: '下载为 Markdown',
  exitFullscreen: '退出全屏',
  externalLinkWarning: '即将打开外部链接',
  imageNotAvailable: '图片不可用',
  mermaidFormatMmd: 'Mermaid',
  mermaidFormatPng: 'PNG',
  mermaidFormatSvg: 'SVG',
  openExternalLink: '打开外部链接',
  openLink: '打开链接',
  tableFormatCsv: 'CSV',
  tableFormatMarkdown: 'Markdown',
  tableFormatTsv: 'TSV',
  viewFullscreen: '查看全屏',
}

function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = React.useState(false)
  const canCopy = text.trim().length > 0

  const copyText = async () => {
    if (!canCopy || typeof window === 'undefined') return
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.setAttribute('aria-hidden', 'true')
      textarea.style.position = 'absolute'
      textarea.style.left = '-9999px'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <IconButton
      icon={copied ? Check : Copy}
      label={copied ? '已复制' : label}
      size="sm"
      disabled={!canCopy}
      onClick={() => void copyText()}
      className={className}
    />
  )
}

export function MessageMarkdown({ content, streaming = false }: { content: string; streaming?: boolean }) {
  const normalizedContent = useMemo(() => normalizeMessageMarkdown(content), [content])
  const components = useMemo(() => ({
    img: ({ alt, src, title }: React.ComponentProps<'img'>) => (
      <img
        alt={alt ?? ''}
        src={src}
        title={title}
        className="my-2 max-h-80 max-w-full rounded-md border border-border object-contain"
      />
    ),
  }), [])

  if (!normalizedContent) return null

  return (
    <div data-testid="message-markdown" className="message-markdown group/message-markdown relative">
      <CopyButton
        text={normalizedContent}
        label="复制整条消息"
        className="absolute right-0 top-0 z-10 opacity-0 shadow-sm transition-opacity group-hover/message-markdown:opacity-100 focus:opacity-100"
      />
      <Streamdown
        mode={streaming ? 'streaming' : 'static'}
        isAnimating={streaming}
        animated={streaming ? { animation: 'fadeIn', duration: 120, sep: 'word', stagger: 8 } : false}
        caret={streaming ? 'block' : undefined}
        controls={{ code: { copy: true, download: false }, table: { copy: true, download: true, fullscreen: false }, mermaid: false }}
        dir="auto"
        parseIncompleteMarkdown
        normalizeHtmlIndentation
        components={components}
        lineNumbers={false}
        translations={STREAMDOWN_TRANSLATIONS}
        className="agenthub-markdown max-w-none break-words text-[15px] leading-[23px] text-foreground"
      >
        {normalizedContent}
      </Streamdown>
    </div>
  )
}
