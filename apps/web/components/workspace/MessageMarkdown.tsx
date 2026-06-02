'use client'

import { Check, Copy } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
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

function CodeBlock({ children, className }: { children: ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false)
  const language = /language-([\w-]+)/.exec(className ?? '')?.[1]
  const text = textFromChildren(children)

  return (
    <div className="my-2 overflow-hidden rounded-md border border-border bg-muted/80" data-testid="markdown-code-block">
      <div className="flex h-8 items-center justify-between border-b border-border px-2 text-xs text-muted-foreground">
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
      <pre className="max-w-full overflow-x-auto p-3 text-xs leading-relaxed">
        <code className={className}>{children}</code>
      </pre>
    </div>
  )
}

export function MessageMarkdown({ content }: { content: string }) {
  if (!content) return null

  return (
    <div
      data-testid="message-markdown"
      className="prose prose-sm max-w-none break-words text-sm dark:prose-invert prose-headings:mb-2 prose-headings:mt-3 prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-blockquote:my-2 prose-blockquote:border-l-2 prose-blockquote:pl-3 prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0 prose-code:break-words prose-table:text-xs"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-2 max-w-full overflow-x-auto rounded-md border border-border" data-testid="markdown-table">
              <table className="m-0 min-w-full border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b border-border bg-muted px-2 py-1 text-left font-medium">{children}</th>,
          td: ({ children }) => <td className="border-t border-border px-2 py-1 align-top">{children}</td>,
          code: ({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: ReactNode }) => (
            inline ? (
              <code className="rounded bg-muted px-1 py-0.5 text-[0.9em]" {...props}>{children}</code>
            ) : (
              <CodeBlock className={className}>{children}</CodeBlock>
            )
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
