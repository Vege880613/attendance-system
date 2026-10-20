// vitest.config.mjs — 使用 .mjs 后缀确保 ESM 语法可被解析
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    // 让 describe / it / expect 等全局可用，测试文件无需显式 import
    globals: true,
    include: ['tests/**/*.test.js', 'src/**/*.test.js'],
    // 每个测试文件独立 fork，避免 better-sqlite3 的 :memory: 库在多个文件间冲突
    pool: 'forks',
    // 每个测试文件独立 fork，确保内存库互不干扰
    poolOptions: {
      forks: { singleFork: false },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(new URL('.', import.meta.url).pathname, 'src'),
    },
  },
});
