/**
 * 数据库迁移脚本 - 添加项目功能和Excel导入支持
 * 运行方式：node src/utils/migrate.js
 */
const db = require('../config/db');

console.log('🔄 开始数据库迁移...');

// 检查并创建 projects 表
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'").all();
if (tables.length === 0) {
  db.exec(`
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'project' CHECK(type IN ('project','system_maintenance')),
      description TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','paused')),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
  console.log('✅ 创建 projects 表');
} else {
  console.log('⏭️  projects 表已存在');
}

// 检查 attendance_requests 是否有 project_id 列
const cols = db.prepare("PRAGMA table_info(attendance_requests)").all();
const hasProjectId = cols.some(c => c.name === 'project_id');
if (!hasProjectId) {
  db.exec('ALTER TABLE attendance_requests ADD COLUMN project_id INTEGER DEFAULT NULL');
  console.log('✅ 添加 attendance_requests.project_id 列');
} else {
  console.log('⏭️  project_id 列已存在');
}

// 插入示例项目数据
const projectCount = db.prepare('SELECT count(*) as c FROM projects').get().c;
if (projectCount === 0) {
  const insert = db.prepare('INSERT INTO projects (name, type, description) VALUES (?,?,?)');
  insert.run('生产线A设备升级', 'project', '2026年度产线自动化改造项目');
  insert.run('ERP系统维护', 'system_maintenance', '月度ERP系统维护与优化');
  insert.run('仓储管理系统开发', 'project', 'WMS仓储管理系统二期开发');
  insert.run('数据库迁移', 'system_maintenance', '数据库服务器迁移维护');
  insert.run('质量检测平台', 'project', '质量检测数据平台建设');
  console.log('✅ 插入 5 个示例项目');
} else {
  console.log(`⏭️  已有 ${projectCount} 个项目，跳过示例数据`);
}

console.log('🎉 数据库迁移完成！');
process.exit(0);
