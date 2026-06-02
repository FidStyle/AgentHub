import { describe, expect, it } from 'vitest'
import { normalizeMessageMarkdown } from '@/lib/chat/markdown'

describe('normalizeMessageMarkdown', () => {
  it('restores block breaks before unordered list markers when model text is flattened', () => {
    const input = '三个文件内容已经准备好： - counter-app/package.json — 仅 express - counter-app/server.js — SQLite 持久化 - counter-app/public/index.html — 前端页面'

    expect(normalizeMessageMarkdown(input)).toBe([
      '三个文件内容已经准备好：',
      '- counter-app/package.json — 仅 express',
      '- counter-app/server.js — SQLite 持久化',
      '- counter-app/public/index.html — 前端页面',
    ].join('\n'))
  })

  it('restores block breaks before ordered list markers', () => {
    const input = '等你授权的三个动作： 1. pnpm add better-sqlite3 2. pnpm add -D @types/better-sqlite3 3. 写 API 路由'

    expect(normalizeMessageMarkdown(input)).toBe([
      '等你授权的三个动作：',
      '1. pnpm add better-sqlite3',
      '2. pnpm add -D @types/better-sqlite3',
      '3. 写 API 路由',
    ].join('\n'))
  })

  it('does not treat plus signs in prose as list markers', () => {
    const input = '本项目用的是 PostgreSQL(pg + drizzle-orm)，前端页面是两个输入框 + 加减按钮。'

    expect(normalizeMessageMarkdown(input)).toBe(input)
  })

  it('does not rewrite fenced code blocks', () => {
    const input = ['说明： - 应渲染为列表', '```', 'const text = "说明： - 不改代码块"', '```'].join('\n')

    expect(normalizeMessageMarkdown(input)).toBe(['说明：', '- 应渲染为列表', '```', 'const text = "说明： - 不改代码块"', '```'].join('\n'))
  })
})
