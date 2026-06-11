import { describe, expect, it } from 'vitest'
import { productDeliveryIntentHeuristic } from '@/lib/orchestrator/intent-classifier'

describe('productDeliveryIntentHeuristic', () => {
  it('recognizes the previously-missed "生成为产物" phrasing', () => {
    expect(productDeliveryIntentHeuristic('将对应的pptx以及md生成为产物')).toBe(true)
  })

  it('recognizes file-extension deliverables', () => {
    expect(productDeliveryIntentHeuristic('帮我导出 report.pdf 和 slides.pptx')).toBe(true)
    expect(productDeliveryIntentHeuristic('生成一个 README.md')).toBe(true)
  })

  it('recognizes any direct mention of 产物', () => {
    expect(productDeliveryIntentHeuristic('把这几个文件登记为产物')).toBe(true)
    expect(productDeliveryIntentHeuristic('作为产物收口')).toBe(true)
  })

  it('recognizes generation verbs paired with deliverable nouns', () => {
    expect(productDeliveryIntentHeuristic('做一个加减乘除的网站')).toBe(true)
    expect(productDeliveryIntentHeuristic('生成一份项目汇报 PPT')).toBe(true)
    expect(productDeliveryIntentHeuristic('写个介绍文档')).toBe(true)
  })

  it('keeps the canonical sqlite calculator prompt', () => {
    expect(productDeliveryIntentHeuristic('做一个加减乘除的简单网站，使用 sqlite 存储历史记录')).toBe(true)
  })

  it('does not flag plain questions or discussion', () => {
    expect(productDeliveryIntentHeuristic('这段代码为什么报错？')).toBe(false)
    expect(productDeliveryIntentHeuristic('解释一下这个函数的作用')).toBe(false)
    expect(productDeliveryIntentHeuristic('帮我看看日志')).toBe(false)
  })
})
