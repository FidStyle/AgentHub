# UI Phase 3 执行总览

## 开发顺序

```text
UI 基础设施
  -> Web 三栏工作台
  -> Desktop Connector Console
  -> Mobile/PWA 轻量界面
  -> 三端视觉 E2E 门禁
```

Web、Desktop、Mobile 三个页面任务都依赖 UI 基础设施；视觉 E2E 门禁依赖三端页面任务。

## 统一测试底线

- 功能断言：核心交互必须可点击、可填写、可流转。
- 视觉截图：关键页面和状态必须截图留存。
- 布局断言：无横向滚动、关键卡片不重叠、长文本不溢出。
- 敏感信息断言：截图和 UI 中不得出现本地 CLI API Key、Base URL、敏感环境变量。

## 后续实现入口

从 `05-25-ui-foundation-design-system` 开始。不要直接跳到页面任务，否则容易继续产生临时内联样式和重复组件。
