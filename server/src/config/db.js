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
    leave_type TEXT NOT NULL CHECK(leave_type IN ('annual','compensatory','mixed','business_trip','other')),
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

// 数据库迁移：添加缺失的列（仅在表已存在时运行）
const migrations = () => {
  try {
    // 检查 holidays 表是否有 year 列
    const holidayCols = db.prepare("PRAGMA table_info(holidays)").all();
    if (!holidayCols.some(col => col.name === 'year')) {
      db.exec("ALTER TABLE holidays ADD COLUMN year INTEGER");
      db.exec("UPDATE holidays SET year = substr(date, 1, 4) WHERE year IS NULL");
      console.log('✅ 已添加 holidays.year 列');
    }

    const columns = db.prepare("PRAGMA table_info(attendance_requests)").all();
    const columnNames = columns.map(col => col.name);

    if (!columnNames.includes('needs_dept_manager')) {
      db.exec("ALTER TABLE attendance_requests ADD COLUMN needs_dept_manager INTEGER DEFAULT 0");
      console.log('✅ 已添加 needs_dept_manager 列');
    }

    if (!columnNames.includes('annual_days')) {
      db.exec("ALTER TABLE attendance_requests ADD COLUMN annual_days REAL DEFAULT 0");
      console.log('✅ 已添加 annual_days 列');
    }

    if (!columnNames.includes('dept_manager_id')) {
      db.exec("ALTER TABLE attendance_requests ADD COLUMN dept_manager_id INTEGER DEFAULT NULL");
      db.exec("ALTER TABLE attendance_requests ADD COLUMN dept_manager_comment TEXT");
      db.exec("ALTER TABLE attendance_requests ADD COLUMN dept_manager_time TEXT");
      console.log('✅ 已添加 dept_manager 列');
    }

    if (!columnNames.includes('pending_dept')) {
      // SQLite 不支持修改 CHECK 约束，需要忽略
      console.log('⚠️ 无法修改 CHECK 约束（pending_dept）');
    }

    if (!columnNames.includes('project_id')) {
      db.exec("ALTER TABLE attendance_requests ADD COLUMN project_id INTEGER DEFAULT NULL");
      console.log('✅ 已添加 project_id 列');
    }
  } catch (e) {
    console.log('迁移跳过:', e.message);
  }
};

migrations();

// 确保 admin 用户存在
const bcrypt = require('bcryptjs');
const ensureAdmin = () => {
  const admin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  if (!admin) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      "INSERT INTO users (username, password_hash, name, role, hire_date, status) VALUES ('admin', ?, '系统管理员', 'manager', '2020-01-01', 'active')"
    ).run(hash);
    console.log('✅ 已创建默认管理员账号 (admin/admin123)');
  }
};
ensureAdmin();

// 确保节假日数据存在
const ensureHolidays = () => {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM holidays').get().cnt;
  if (count === 0) {
    const holidays = [
      ['2026-01-01', '元旦', 'holiday'],
      ['2026-02-16', '春节', 'holiday'],
      ['2026-02-17', '春节', 'holiday'],
      ['2026-02-18', '春节', 'holiday'],
      ['2026-02-19', '春节', 'holiday'],
      ['2026-02-20', '春节', 'holiday'],
      ['2026-02-21', '春节', 'holiday'],
      ['2026-02-22', '春节', 'holiday'],
      ['2026-02-14', '春节调休', 'workday'],
      ['2026-02-28', '春节调休', 'workday'],
      ['2026-04-04', '清明节', 'holiday'],
      ['2026-04-05', '清明节', 'holiday'],
      ['2026-04-06', '清明节', 'holiday'],
      ['2026-05-01', '劳动节', 'holiday'],
      ['2026-05-02', '劳动节', 'holiday'],
      ['2026-05-03', '劳动节', 'holiday'],
      ['2026-05-04', '劳动节', 'holiday'],
      ['2026-05-05', '劳动节', 'holiday'],
      ['2026-04-26', '劳动节调休', 'workday'],
      ['2026-06-19', '端午节', 'holiday'],
      ['2026-06-20', '端午节', 'holiday'],
      ['2026-06-21', '端午节', 'holiday'],
      ['2026-09-25', '中秋节', 'holiday'],
      ['2026-09-26', '中秋节', 'holiday'],
      ['2026-09-27', '中秋节', 'holiday'],
      ['2026-09-20', '中秋调休', 'workday'],
      ['2026-10-01', '国庆节', 'holiday'],
      ['2026-10-02', '国庆节', 'holiday'],
      ['2026-10-03', '国庆节', 'holiday'],
      ['2026-10-04', '国庆节', 'holiday'],
      ['2026-10-05', '国庆节', 'holiday'],
      ['2026-10-06', '国庆节', 'holiday'],
      ['2026-10-07', '国庆节', 'holiday'],
      ['2026-10-10', '国庆调休', 'workday'],
      ['2026-12-31', '元旦前夕', 'holiday'],
    ];
    const insert = db.prepare('INSERT INTO holidays (date, name, type, year) VALUES (?, ?, ?, ?)');
    holidays.forEach(h => insert.run(h[0], h[1], h[2], h[0].slice(0, 4)));
    console.log(`✅ 已创建 ${holidays.length} 条节假日数据`);
  }
};
ensureHolidays();

// 确保项目数据存在
const ensureProjects = () => {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM projects').get().cnt;
  if (count === 0) {
    const projects = [
      ['生产线A设备升级', 'project', '2026年度产线自动化改造项目'],
      ['ERP系统维护', 'system_maintenance', '月度ERP系统维护与优化'],
      ['仓储管理系统开发', 'project', 'WMS仓储管理系统二期开发'],
      ['数据库迁移', 'system_maintenance', '数据库服务器迁移维护'],
      ['质量检测平台', 'project', '质量检测数据平台建设'],
      ['SES二开项目', 'project', ''],
    ];
    const insert = db.prepare('INSERT INTO projects (name, type, description) VALUES (?, ?, ?)');
    projects.forEach(p => insert.run(p[0], p[1], p[2]));
    console.log(`✅ 已创建 ${projects.length} 个项目数据`);
  }
};
ensureProjects();

// 确保班组数据存在
const ensureTeams = () => {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM teams').get().cnt;
  if (count === 0) {
    const teams = [
      ['生产车间A', 12],
      ['生产车间B', 21],
      ['质检部', 13],
    ];
    const insert = db.prepare('INSERT INTO teams (name, lead_user_id) VALUES (?, ?)');
    teams.forEach(t => insert.run(t[0], t[1]));
    console.log(`✅ 已创建 ${teams.length} 个班组数据`);
  }
};
ensureTeams();

// 确保用户数据存在
const ensureUsers = () => {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  if (count <= 1) {
    const hash = bcrypt.hashSync('123456', 10);
    const users = [
      ['lisi', '李四', 'employee', 1, '2015-03-01'],
      ['wangwu', '王五', 'team_lead', 1, '2012-07-15'],
      ['zhaoliu', '赵六', 'team_lead', 3, '2018-01-10'],
      ['zhangsan', '张三', 'employee', 1, '2020-06-01'],
      ['zhangsi', '张四', 'employee', 1, '2022-02-15'],
      ['sunqi', '孙七', 'employee', 2, '2019-08-20'],
      ['sunba', '孙八', 'employee', 2, '2023-01-05'],
      ['zhoujiu', '周九', 'employee', 3, '2021-04-12'],
      ['wushi', '吴十', 'employee', 3, '2017-11-30'],
      ['bumen', '部门经理', 'dept_manager', null, '2016-05-01'],
      ['niezhikun', '聂志坤', 'team_lead', 2, '2014-09-01'],
      ['gaolongfei', '高龙飞', 'employee', 2, '2016-10-01'],
      ['mayutao', '马宇涛', 'manager', null, '2010-01-01'],
      ['shenkuo', '沈阔', 'dept_manager', null, '2013-06-01'],
    ];
    const insert = db.prepare('INSERT OR IGNORE INTO users (username, password_hash, name, role, team_id, hire_date, status) VALUES (?, ?, ?, ?, ?, ?, \'active\')');
    users.forEach(u => insert.run(u[0], hash, u[1], u[2], u[3], u[4]));
    console.log(`✅ 已创建 ${users.length} 个用户数据`);
  }
};
ensureUsers();

module.exports = db;
