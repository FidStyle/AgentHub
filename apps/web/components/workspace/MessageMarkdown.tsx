'use client'

import React, { useMemo } from 'react'
import { Streamdown, type StreamdownTranslations } from 'streamdown'
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
    <div data-testid="message-markdown" className="message-markdown">
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
        className="max-w-none break-words text-[15px] leading-[22px] text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:my-2 [&_blockquote]:border-l-[3px] [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:break-words [&_li]:my-0.5 [&_li]:leading-[22px] [&_ol]:my-1.5 [&_p]:my-1 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_table]:text-[13px] [&_table]:leading-5 [&_ul]:my-1.5"
      >
        {normalizedContent}
      </Streamdown>
    </div>
  )
}
