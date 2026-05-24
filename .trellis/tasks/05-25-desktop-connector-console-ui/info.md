# 实现说明：Desktop Connector Console 视觉重构

## 重点文件候选

- `apps/desktop/src/renderer/App.tsx`
- `apps/desktop/src/renderer/components/RuntimeStatus.tsx`
- `apps/desktop/src/renderer/components/RuntimeConfigPage.tsx`
- `apps/desktop/src/renderer/components/*`
- `e2e/tests/desktop/electron.spec.ts`

## 开发顺序

1. 先改 Electron E2E：从“Runtime 配置 API Key 表单”转为“Runtime 检测和诊断状态”。
2. 抽 Connector Console 布局。
3. 重构 Runtime 状态卡，移除本地 API Key 表单。
4. 增加执行活动和待审批视觉结构。
5. 补截图、无重叠、无横向滚动断言。

## 风险

- 不要改 Electron main 的安全边界。
- renderer 不能新增 Node 直连能力。
- 如果测试还在期待 API Key 配置页，必须同步改为凭证边界测试。
