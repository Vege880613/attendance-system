/**
 * 数据库迁移脚本 v2 - 假期类型重构
 */
const db = require('../config/db');

console.log('🔄 开始数据库迁移 v2...');

// 1. 重建 leave_balances 表（更新 CHECK 约束）
const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='leave_balances'").get();
if (tableExists && tableExists.name) {
  // 备份旧数据
  const oldData = db.prepare('SELECT * FROM leave_balances').all();

  // 删除旧表并重建
  db.exec('DROP TABLE IF EXISTS leave_balances');

  db.exec(`
    CREATE TABLE leave_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      leave_type TEXT NOT NULL CHECK(leave_type IN ('annual','compensatory','business_trip','other')),
      year INTEGER NOT NULL,
      entitled_days REAL NOT NULL DEFAULT 0,
      used_days REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(user_id, leave_type, year)
    );
  `);

  // 迁移旧数据
  const insert = db.prepare(`
    INSERT INTO leave_balances (user_id, leave_type, year, entitled_days, used_days, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  oldData.forEach(row => {
    let newType = row.leave_type;
    // 映射旧类型: marriage -> other, funeral -> other
    if (row.leave_type === 'marriage' || row.leave_type === 'funeral') {
      newType = 'other';
    }
    insert.run(row.user_id, newType, row.year, row.entitled_days, row.used_days, row.created_at);
  });
  console.log(`✅ leave_balances 表重建完成，迁移 ${oldData.length} 条记录`);
}

// 2. 为 overtime_units 添加调休关联字段
const overtimeCols = db.prepare("PRAGMA table_info(overtime_units)").all();
const overtimeColNames = overtimeCols.map(c => c.name);

if (!overtimeColNames.includes('leave_request_id')) {
  db.exec('ALTER TABLE overtime_units ADD COLUMN leave_request_id INTEGER DEFAULT NULL');
  console.log('✅ 添加 overtime_units.leave_request_id');
}
if (!overtimeColNames.includes('leave_type_mark')) {
  db.exec("ALTER TABLE overtime_units ADD COLUMN leave_type_mark TEXT DEFAULT NULL");
  console.log('✅ 添加 overtime_units.leave_type_mark');
}

// 3. 重建 attendance_requests 表（更新 leave_type_used 约束）
const reqTableExists = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='attendance_requests'").get();
if (reqTableExists && reqTableExists.sql && !reqTableExists.sql.includes('compensatory')) {
  // 备份
  const oldReqs = db.prepare('SELECT * FROM attendance_requests').all();

  db.exec('DROP TABLE IF EXISTS attendance_requests');
  db.exec(`
    CREATE TABLE attendance_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('overtime','leave','special_leave')),
      subtype TEXT DEFAULT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days REAL DEFAULT 0,
      overtime_units_used INTEGER DEFAULT 0,
      leave_type_used TEXT DEFAULT 'none' CHECK(leave_type_used IN ('annual','compensatory','business_trip','other','none')),
      reason TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','entered')),
      team_lead_id INTEGER DEFAULT NULL,
      team_lead_comment TEXT,
      team_lead_time TEXT,
      manager_id INTEGER DEFAULT NULL,
      manager_comment TEXT,
      manager_time TEXT,
      project_id INTEGER DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // 迁移
  const insertReq = db.prepare(`
    INSERT INTO attendance_requests
    (id, user_id, type, subtype, start_date, end_date, days, overtime_units_used,
     leave_type_used, reason, status, team_lead_id, team_lead_comment, team_lead_time,
     manager_id, manager_comment, manager_time, project_id, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  oldReqs.forEach(r => {
    let newLeaveType = r.leave_type_used;
    if (r.leave_type_used === 'marriage' || r.leave_type_used === 'funeral') {
      newLeaveType = 'other';
    }
    insertReq.run(r.id, r.user_id, r.type, r.subtype, r.start_date, r.end_date, r.days,
      r.overtime_units_used, newLeaveType, r.reason, r.status, r.team_lead_id,
      r.team_lead_comment, r.team_lead_time, r.manager_id, r.manager_comment,
      r.manager_time, r.project_id, r.created_at);
  });
  console.log(`✅ attendance_requests 表重建完成，迁移 ${oldReqs.length} 条记录`);
}

// 4. 为所有活跃用户创建调休余额
const currentYear = new Date().getFullYear();
const users = db.prepare("SELECT id FROM users WHERE status = 'active'").all();
const insertComp = db.prepare(`
  INSERT INTO leave_balances (user_id, leave_type, year, entitled_days, used_days)
  VALUES (?, 'compensatory', ?, 0, 0)
  ON CONFLICT(user_id, leave_type, year) DO NOTHING
`);
let compCount = 0;
users.forEach(u => {
  const info = insertComp.run(u.id, currentYear);
  if (info.changes > 0) compCount++;
});
console.log(`✅ 为 ${compCount} 人创建调休余额记录`);

console.log('🎉 数据库迁移 v2 完成！');
process.exit(0);
