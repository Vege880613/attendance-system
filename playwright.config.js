import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: false, // 共享运行中的数据库，串行执行
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    // 使用系统已安装的 Google Chrome，避免下载 Playwright 自带 Chromium
    channel: 'chrome',
    baseURL: 'http://localhost:5173',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // 假设前后端已由开发者手动启动（当前已运行于 :3000 / :5173）
  // webServer: [
  //   { command: 'npm --prefix ../server run start', port: 3000, reuseExistingServer: true },
  //   { command: 'npm --prefix ../client run dev', port: 5173, reuseExistingServer: true },
  // ],
})
