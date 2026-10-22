import { test, expect } from '@playwright/test'
import { loginAs } from './fixtures'

test.describe('登录流程', () => {
  test('页面渲染标题、默认账号提示、输入框和按钮', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('人员考勤管理系统')).toBeVisible()
    await expect(page.getByText(/admin \/ admin123/)).toBeVisible()
    await expect(page.getByPlaceholder('用户名')).toBeVisible()
    await expect(page.getByPlaceholder('密码')).toBeVisible()
    await expect(page.getByRole('button', { name: /登.*录/ })).toBeVisible()
  })

  test('管理员登录成功进入仪表盘', async ({ page }) => {
    await loginAs(page, 'admin', 'admin123')
    await expect(page).toHaveURL(/dashboard/)
  })

  test('密码错误显示提示', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('用户名').fill('admin')
    await page.getByPlaceholder('密码').fill('wrong-password')
    await page.getByRole('button', { name: /登.*录/ }).click()
    await expect(page.getByText(/用户名或密码错误/)).toBeVisible()
  })

  test('空字段提交显示校验', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /登.*录/ }).click()
    await expect(page.getByText('请输入用户名')).toBeVisible()
  })
})

test.describe('登录后导航', () => {
  test('管理员能看到考勤录入入口', async ({ page }) => {
    await loginAs(page, 'admin', 'admin123')
    await page.goto('/attendance/entry')
    await expect(page.getByText(/考勤录入/)).toBeVisible()
  })

  test('员工能看到假期余额', async ({ page }) => {
    await loginAs(page, 'zhangsan', '123456')
    await page.goto('/leave')
    await expect(page.locator('.ant-card-head-title').filter({ hasText: '假期余额' })).toBeVisible()
  })
})
