'use client'

import React, { useMemo } from 'react'
import { Check, Copy } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { IconButton } from '@agenthub/ui'
import { normalizeMessageMarkdown } from '@/lib/chat/markdown'

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

function textFromChildren(children: React.ReactNode): string {
  let text = ''
  React.Children.forEach(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      text += child
      return
    }
    if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
      text += textFromChildren(child.props.children)
    }
  })
  return text
}

function MarkdownCode({
  children,
  className,
  ...rest
}: React.ComponentProps<'code'> & { node?: unknown }) {
  const { node, ...codeProps } = rest
  void node

  return (
    <code {...codeProps} className={className}>
      {children}
    </code>
  )
}

function MarkdownPre({
  children,
  ...rest
}: React.ComponentProps<'pre'> & { node?: unknown }) {
  const { node, ...preProps } = rest
  void node
  const child = React.Children.toArray(children).find(React.isValidElement)

  if (!React.isValidElement<{ children?: React.ReactNode; className?: string }>(child)) {
    return <pre {...preProps}>{children}</pre>
  }

  const className = child.props.className
  const code = textFromChildren(child.props.children).replace(/\n$/, '')
  const language = /language-([\w-]+)/.exec(className ?? '')?.[1] ?? ''

  return (
    <div data-streamdown="code-block" className="group/code-block">
      <div data-streamdown="code-block-header">
        <span data-language={language || 'text'}>{language || 'text'}</span>
        <CopyButton
          text={code}
          label="复制代码"
          className="opacity-100 shadow-none"
        />
      </div>
      <pre {...preProps} data-streamdown="code-block-body">
        <code className={className}>{code}</code>
      </pre>
    </div>
  )
}

export function MessageMarkdown({ content, streaming = false }: { content: string; streaming?: boolean }) {
  const normalizedContent = useMemo(() => normalizeMessageMarkdown(content), [content])
  const components = useMemo(() => ({
    code: MarkdownCode,
    pre: MarkdownPre,
    a: ({ children, href, node, ...rest }: React.ComponentProps<'a'> & { node?: unknown }) => {
      void node
      return (
        <a href={href} target={href?.startsWith('#') ? undefined : '_blank'} rel={href?.startsWith('#') ? undefined : 'noreferrer'} {...rest}>
          {children}
        </a>
      )
    },
    img: ({ alt, src, title }: React.ComponentProps<'img'>) => (
      <img
        alt={alt ?? ''}
        src={src}
        title={title}
        className="my-2 max-h-80 max-w-full rounded-md border border-border object-contain"
      />
    ),
    table: ({ children, node, ...rest }: React.ComponentProps<'table'> & { node?: unknown }) => {
      void node
      return (
        <div data-streamdown="table-wrapper">
          <table {...rest}>{children}</table>
        </div>
      )
    },
  }), [])

  if (!normalizedContent) return null

  return (
    <div data-testid="message-markdown" className="message-markdown group/message-markdown">
      <div className="message-markdown-actions">
        <CopyButton
          text={normalizedContent}
          label="复制整条消息"
          className="opacity-100 shadow-sm transition-opacity md:opacity-0 md:group-hover/message-markdown:opacity-100 md:group-focus-within/message-markdown:opacity-100"
        />
      </div>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[rehypeKatex]}
        components={components}
        className={`agenthub-markdown max-w-none break-words text-[15px] leading-[23px] text-foreground ${streaming ? 'after:ml-1 after:inline-block after:h-4 after:w-2 after:animate-pulse after:bg-current after:align-text-bottom after:content-[""]' : ''}`}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  )
}
