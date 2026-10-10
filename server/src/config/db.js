const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', '..', 'data', 'attendance.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 先创建所有表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
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

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    lead_user_id INTEGER DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    work_date TEXT NOT NULL,
    check_in TEXT DEFAULT NULL,
    check_out TEXT DEFAULT NULL,
    effective_hours REAL DEFAULT 0,
    standard_hours REAL DEFAULT 8.00,
    is_shortage INTEGER DEFAULT 0,
    offset_type TEXT DEFAULT 'none' CHECK(offset_type IN ('none','overtime','annual_leave')),
    offset_units REAL DEFAULT 0,
    remark TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(user_id, work_date)
  );

  CREATE TABLE IF NOT EXISTS overtime_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    work_date TEXT NOT NULL,
    hours REAL NOT NULL DEFAULT 3.00,
    units_count INTEGER NOT NULL DEFAULT 1,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','used','cancelled')),
    request_id INTEGER DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS leave_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    leave_type TEXT NOT NULL CHECK(leave_type IN ('annual','compensatory','business_trip','other')),
    year INTEGER NOT NULL,
    entitled_days REAL NOT NULL DEFAULT 0,
    used_days REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(user_id, leave_type, year)
  );

  CREATE TABLE IF NOT EXISTS attendance_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('overtime','leave','special_leave')),
    subtype TEXT DEFAULT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    days REAL DEFAULT 0,
    overtime_units_used INTEGER DEFAULT 0,
    leave_type_used TEXT DEFAULT 'none' CHECK(leave_type_used IN ('annual','compensatory','mixed','business_trip','other','none')),
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','entered','pending_dept')),
    team_lead_id INTEGER DEFAULT NULL,
    team_lead_comment TEXT,
    team_lead_time TEXT,
    dept_manager_id INTEGER DEFAULT NULL,
    dept_manager_comment TEXT,
    dept_manager_time TEXT,
    manager_id INTEGER DEFAULT NULL,
    manager_comment TEXT,
    manager_time TEXT,
    needs_dept_manager INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    annual_days REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    detail TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'project' CHECK(type IN ('project','system_maintenance')),
    description TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','paused')),
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('holiday','workday')),
    year INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// 导入种子数据（如果数据库为空）
const seedPath = path.join(__dirname, '..', '..', 'data', 'seed.sql');
if (fs.existsSync(seedPath)) {
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  if (userCount === 0) {
    const seedSQL = fs.readFileSync(seedPath, 'utf8');
    db.exec(seedSQL);
    console.log('✅ 已导入种子数据');
  }
}

module.exports = db;
