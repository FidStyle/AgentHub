---
title: "Test Conventions"
readMode: required
priority: high
category: test
keywords:
  - test
  - coverage
  - mock
  - fixture
  - assertion
  - framework
---

# Test Conventions

## Framework

## Directory Structure

## Naming Conventions

## Patterns

## Entries



<spec-entry category="test" keywords="e2e,visual,playwright" date="2026-05-24">

### 视觉与交互 E2E

所有 UI 修改必须对应 Playwright 的深度交互测试。不仅要断言逻辑，必须断言卡片渲染、无重叠、状态切换等视觉结果。拒绝仅用 toBeVisible 糊弄。

</spec-entry>

<spec-entry category="test" keywords="playwright,e2e,visual,布局,断言" date="2026-05-26">

### 测试必须包含 Playwright 功能与视觉断言

所有 UI 修改的测试必须包含 Playwright 深度交互测试（功能断言）和视觉/布局断言（截图对比、无重叠、状态切换）。拒绝仅用 toBeVisible 糊弄。E2E 测试必须覆盖 golden path 和边界情况。

</spec-entry>