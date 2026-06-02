'use client'

import { Check, Copy } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import 'highlight.js/styles/github.css'
import { IconButton } from '@agenthub/ui'

function textFromChildren(children: unknown): string {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(textFromChildren).join('')
  if (children && typeof children === 'object' && 'props' in children) {
    return textFromChildren((children as { props?: { children?: unknown } }).props?.children)
  }
  return ''
}

function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const codeElement = Array.isArray(children) ? children[0] : children
  const codeProps = codeElement && typeof codeElement === 'object' && 'props' in codeElement
    ? (codeElement as { props?: { className?: string; children?: ReactNode } }).props
    : undefined
  const className = codeProps?.className
  const codeChildren = codeProps?.children ?? children
  const language = /language-([\w-]+)/.exec(className ?? '')?.[1]
  const text = textFromChildren(codeChildren)

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border/80 bg-muted/70" data-testid="markdown-code-block">
      <div className="flex h-8 items-center justify-between px-3 text-xs leading-4 text-muted-foreground">
        <span>{language ?? 'text'}</span>
        <IconButton
          icon={copied ? Check : Copy}
          label={copied ? '已复制代码' : '复制代码'}
          size="sm"
          variant="ghost"
          data-testid="markdown-copy-code"
          onClick={async () => {
            await navigator.clipboard?.writeText(text)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1200)
          }}
        />
      </div>
      <pre className="max-w-full overflow-x-auto px-3 pb-3 text-[13px] leading-5">
        <code className={className}>{codeChildren}</code>
      </pre>
    </div>
  )
}

export function MessageMarkdown({ content, streaming = false }: { content: string; streaming?: boolean }) {
  const components = useMemo(() => ({
    a: ({ href, children }: { href?: string; children?: ReactNode }) => (
      <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
        {children}
      </a>
    ),
    table: ({ children }: { children?: ReactNode }) => (
      <div className="my-2 max-w-full overflow-x-auto rounded-md border border-border" data-testid="markdown-table">
        <table className="m-0 min-w-full border-collapse">{children}</table>
      </div>
    ),
    th: ({ children }: { children?: ReactNode }) => <th className="border-b border-border bg-muted px-2 py-1.5 text-left font-medium">{children}</th>,
    td: ({ children }: { children?: ReactNode }) => <td className="min-w-[120px] border-t border-border px-2 py-1.5 align-top">{children}</td>,
    pre: ({ children }: { children?: ReactNode }) => <CodeBlock>{children}</CodeBlock>,
    code: ({ className, children, ...props }: { className?: string; children?: ReactNode }) => (
      <code className={className ? `${className} rounded bg-transparent` : 'rounded bg-muted px-1.5 py-0.5 text-[0.92em] font-semibold'} {...props}>
        {children}
      </code>
    ),
  }), [])

  if (!content) return null

  return (
    <div
      data-testid="message-markdown"
      className="prose max-w-none break-words text-[15px] leading-[22px] text-foreground dark:prose-invert prose-headings:mb-2 prose-headings:mt-3 prose-headings:leading-snug prose-p:my-1 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-li:leading-[22px] prose-blockquote:my-2 prose-blockquote:border-l-[3px] prose-blockquote:border-border prose-blockquote:pl-3 prose-blockquote:text-muted-foreground prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0 prose-code:break-words prose-table:text-[13px] prose-table:leading-5"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
      {streaming && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse rounded-full bg-muted-foreground" aria-hidden="true" />}
    </div>
  )
}
