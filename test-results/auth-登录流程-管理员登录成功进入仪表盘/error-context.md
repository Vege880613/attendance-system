# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.js >> 登录流程 >> 管理员登录成功进入仪表盘
- Location: e2e/auth.spec.js:14:7

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
        - textbox "密码" [active] [ref=e32]: admin123
        - img "eye-invisible" [ref=e34] [cursor=pointer]
      - button "登 录" [ref=e43] [cursor=pointer]
    - paragraph [ref=e46]: "默认管理员: admin / admin123"
```

# Test source

```ts
  1  | /**
  2  |  * E2E 共享 helper
  3  |  * 测试数据与运行中的数据库一致：admin/admin123, lead/123456, alice/123456
  4  |  */
  5  | export async function loginAs(page, username, password) {
  6  |   await page.goto('/login')
  7  |   await page.getByPlaceholder('用户名').fill(username)
  8  |   await page.getByPlaceholder('密码').fill(password)
> 9  |   await page.getByRole('button', { name: '登录' }).click()
     |                                                  ^ Error: locator.click: Test timeout of 30000ms exceeded.
  10 |   await page.waitForURL('**/dashboard')
  11 | }
  12 | 
```