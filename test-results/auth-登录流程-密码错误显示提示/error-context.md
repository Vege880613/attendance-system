# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.js >> 登录流程 >> 密码错误显示提示
- Location: e2e/auth.spec.js:19:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: '登录' })

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]: 人员考勤管理系统
  - generic [ref=e8]:
    - heading "登 录" [level=2] [ref=e9]
    - generic [ref=e10]:
      - generic [ref=e16]:
        - img "user" [ref=e18]
        - textbox "用户名" [ref=e21]: admin
      - generic [ref=e27]:
        - img "lock" [ref=e29]
        - textbox "密码" [active] [ref=e32]: wrong-password
        - img "eye-invisible" [ref=e34] [cursor=pointer]
      - button "登 录" [ref=e43] [cursor=pointer]
    - paragraph [ref=e46]: "默认管理员: admin / admin123"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | import { loginAs } from './fixtures'
  3  | 
  4  | test.describe('登录流程', () => {
  5  |   test('页面渲染标题、默认账号提示、输入框和按钮', async ({ page }) => {
  6  |     await page.goto('/login')
  7  |     await expect(page.getByText('人员考勤管理系统')).toBeVisible()
  8  |     await expect(page.getByText(/admin \/ admin123/)).toBeVisible()
  9  |     await expect(page.getByPlaceholder('用户名')).toBeVisible()
  10 |     await expect(page.getByPlaceholder('密码')).toBeVisible()
  11 |     await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
  12 |   })
  13 | 
  14 |   test('管理员登录成功进入仪表盘', async ({ page }) => {
  15 |     await loginAs(page, 'admin', 'admin123')
  16 |     await expect(page).toHaveURL(/dashboard/)
  17 |   })
  18 | 
  19 |   test('密码错误显示提示', async ({ page }) => {
  20 |     await page.goto('/login')
  21 |     await page.getByPlaceholder('用户名').fill('admin')
  22 |     await page.getByPlaceholder('密码').fill('wrong-password')
> 23 |     await page.getByRole('button', { name: '登录' }).click()
     |                                                    ^ Error: locator.click: Test timeout of 30000ms exceeded.
  24 |     await expect(page.getByText(/用户名或密码错误/)).toBeVisible()
  25 |   })
  26 | 
  27 |   test('空字段提交显示校验', async ({ page }) => {
  28 |     await page.goto('/login')
  29 |     await page.getByRole('button', { name: '登录' }).click()
  30 |     await expect(page.getByText(/不能为空/)).toBeVisible()
  31 |   })
  32 | })
  33 | 
  34 | test.describe('登录后导航', () => {
  35 |   test('管理员能看到考勤录入入口', async ({ page }) => {
  36 |     await loginAs(page, 'admin', 'admin123')
  37 |     await page.goto('/attendance/entry')
  38 |     await expect(page.getByText(/考勤录入/)).toBeVisible()
  39 |   })
  40 | 
  41 |   test('员工能看到假期余额', async ({ page }) => {
  42 |     await loginAs(page, 'alice', '123456')
  43 |     await page.goto('/leave')
  44 |     await expect(page.getByText(/假期余额|年假/)).toBeVisible()
  45 |   })
  46 | })
  47 | 
```