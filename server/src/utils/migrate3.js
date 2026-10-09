/**
 * 数据库迁移脚本 v3 - 部门经理角色 + 加班请假日期关联
 * 运行方式：node src/utils/migrate3.js
 */
const db = require('../config/db');

console.log('🔄 开始数据库迁移 v3...');

// 1. 更新 users 表的 role CHECK 约束（添加 dept_manager）
const userTableSql = db.prepare("SELECT sql FROM sqlite_master WHERE name='users'").get();
if (userTableSql && userTableSql.sql && !userTableSql.sql.includes('dept_manager')) {
  // 备份旧数据
  const oldUsers = db.prepare('SELECT * FROM users').all();

  db.exec('DROP TABLE IF EXISTS users');
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee' CHECK(role IN ('employee','team_lead','dept_manager','manager')),
      team_id INTEGER DEFAULT NULL,
      hire_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','resigned')),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // 恢复数据
  const insert = db.prepare(`
    INSERT INTO users (id, username, password_hash, name, role, team_id, hire_date, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  oldUsers.forEach(u => {
    insert.run(u.id, u.username, u.password_hash, u.name, u.role, u.team_id, u.hire_date, u.status, u.created_at);
  });
  console.log('✅ users 表更新完成（添加 dept_manager 角色）');
} else {
  console.log('⏭️  users 表已包含 dept_manager');
}

// 2. 为 overtime_units 添加 leave_dates 字段（JSON 格式存储关联请假日期）
const overtimeCols = db.prepare("PRAGMA table_info(overtime_units)").all();
const overtimeColNames = overtimeCols.map(c => c.name);

if (!overtimeColNames.includes('leave_dates')) {
  db.exec("ALTER TABLE overtime_units ADD COLUMN leave_dates TEXT DEFAULT NULL");
  console.log('✅ 添加 overtime_units.leave_dates');
} else {
  console.log('⏭️  overtime_units.leave_dates 已存在');
}

// 3. 为 attendance_requests 添加 dept_manager 审批字段
const reqCols = db.prepare("PRAGMA table_info(attendance_requests)").all();
const reqColNames = reqCols.map(c => c.name);

if (!reqColNames.includes('dept_manager_id')) {
  db.exec('ALTER TABLE attendance_requests ADD COLUMN dept_manager_id INTEGER DEFAULT NULL');
  console.log('✅ 添加 attendance_requests.dept_manager_id');
} else {
  console.log('⏭️  attendance_requests.dept_manager_id 已存在');
}

if (!reqColNames.includes('dept_manager_comment')) {
  db.exec('ALTER TABLE attendance_requests ADD COLUMN dept_manager_comment TEXT DEFAULT NULL');
  console.log('✅ 添加 attendance_requests.dept_manager_comment');
} else {
  console.log('⏭️  attendance_requests.dept_manager_comment 已存在');
}

if (!reqColNames.includes('dept_manager_time')) {
  db.exec('ALTER TABLE attendance_requests ADD COLUMN dept_manager_time TEXT DEFAULT NULL');
  console.log('✅ 添加 attendance_requests.dept_manager_time');
} else {
  console.log('⏭️  attendance_requests.dept_manager_time 已存在');
}

// 4. 创建部门经理账号（如果不存在）
const deptMgr = db.prepare("SELECT * FROM users WHERE username = 'bumen'").get();
if (!deptMgr) {
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('123456', 10);
  db.prepare(
    "INSERT INTO users (username, password_hash, name, role, hire_date, status) VALUES (?, ?, '部门经理', 'dept_manager', '2018-01-01', 'active')"
  ).run('bumen', hash);
  console.log('✅ 创建部门经理账号: bumen/123456');
} else {
  console.log('⏭️  部门经理账号已存在');
}

console.log('🎉 数据库迁移 v3 完成！');
console.log('');
console.log('=== 角色层级 ===');
console.log('  employee: 员工（申请）');
console.log('  team_lead: 班组长（审核）');
console.log('  dept_manager: 部门经理（审批>3天请假）');
console.log('  manager: 管理人员（确认录入）');
process.exit(0);
