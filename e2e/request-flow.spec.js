import { test, expect } from '@playwright/test'
import { loginAs } from './fixtures'

test.describe('申请 → 审批全流程', () => {
  test('员工提交年假申请 → 组长审批通过', async ({ page }) => {
    // 唯一事由，避免与历史数据混淆，便于审批时精确定位本次申请
    const reason = `E2E年假申请-${Date.now()}`

    // 1. 员工（zhangsan）登录并提交年假申请
    await loginAs(page, 'zhangsan', '123456')
    await page.goto('/requests/new')

    // 申请类型：选择「休假申请」
    await page.locator('.ant-select').first().locator('.ant-select-selector').click()
    await page.locator('.ant-select-item-option').filter({ hasText: '休假申请' }).click()

    // 假期类型：选择「年假」
    await page.locator('.ant-select').nth(1).locator('.ant-select-selector').click()
    await page.locator('.ant-select-item-option').filter({ hasText: /^年假$/ }).click()

    // 开始/结束日期：同一天 = 1 天（默认上午到下午）
    // ant-design-vue 的 DatePicker 用 fill 不触发日期选中，需用 type 模拟真实输入
    const pickers = page.locator('.ant-picker')
    const startDate = pickers.nth(0).locator('input')
    const endDate = pickers.nth(1).locator('input')

    await startDate.click()
    await startDate.pressSequentially('2026-12-01')
    await startDate.press('Enter')

    await endDate.click()
    await endDate.pressSequentially('2026-12-01')
    await endDate.press('Enter')

    // 确认天数已自动计算（同一天上午到下午 = 1 天）
    await expect(page.locator('.ant-input-number-input')).toHaveValue('1.0')

    // 申请事由
    await page.getByPlaceholder('请输入事由').fill(reason)

    // 提交
    await page.getByRole('button', { name: '提交申请' }).click()
    await expect(page.locator('.ant-message')).toContainText(/申请已提交/)

    // 2. 组长（niezhikun）登录并审批
    await loginAs(page, 'niezhikun', '123456')
    await page.goto('/requests/review')

    // 审批列表不显示申请事由，改用「申请人 + 假期类型」定位本次休假申请行
    // 列表按 id 升序，多次运行可能有多条，取最后一条（本次新提交）
    const row = page.locator('.ant-table-row')
      .filter({ hasText: '张三' })
      .filter({ hasText: '年假' })
      .last()
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: /通.*过/ }).click()

    // 确认弹窗
    await page.locator('.ant-modal').locator('.ant-btn-primary').click()

    // 验证审核通过
    await expect(page.locator('.ant-message')).toContainText(/审核通过/)
  })
})
