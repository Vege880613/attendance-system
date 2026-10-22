/**
 * E2E 共享 helper
 * 测试数据与运行中的数据库一致：
 * - 管理员：admin / admin123
 * - 员工：zhangsan / 123456（张三，应用管理部 team_id=4）
 * - 组长：niezhikun / 123456（聂志坤，应用管理部 lead）
 */
export async function loginAs(page, username, password) {
  await page.goto('/login')
  await page.getByPlaceholder('用户名').fill(username)
  await page.getByPlaceholder('密码').fill(password)
  await page.getByRole('button', { name: /登.*录/ }).click()
  await page.waitForURL('**/dashboard')
}
