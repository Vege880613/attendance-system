/**
 * 测试种子数据助手
 *
 * 使用：
 *   const { seed, loginAs, ADMIN, EMPLOYEE, TEAM_LEAD, TEAM, PROJECT } = require('./seed');
 *   seed();                       // 创建团队、用户、项目、年假余额
 *   const token = loginAs(ADMIN); // 拿到该角色的 JWT
 *
 * 注意：必须在 NODE_ENV=test 下使用，否则会污染真实数据。
 *       每个 vitest fork 进程有独立内存库，种子在每个文件中执行一次即可。
 */
const bcrypt = require('bcryptjs');

// 固定的测试数据（写死，方便断言）
const TEAM = { id: 1, name: '测试一组' };
const EMPLOYEE = { username: 'alice', password: '123456', name: '爱丽丝', role: 'employee', hire_date: '2020-06-15' };
const TEAM_LEAD = { username: 'lead', password: '123456', name: '李组长', role: 'team_lead', hire_date: '2018-01-10' };
const PROJECT = { id: 1, name: '项目Alpha', type: 'project' };

// admin 已由 app.js 的 ensureAdmin() 创建，role=manager, username=admin, password=admin123
const ADMIN = { username: 'admin', password: 'admin123', name: '系统管理员', role: 'manager' };

/**
 * 向内存库写入：1 个团队 + 1 个组长 + 1 个员工 + 1 个项目
 * 同时给员工初始化 5 天年假余额。
 */
function seed() {
  const db = require('../src/config/db');
  const year = new Date().getFullYear();

  // 团队（组长先插入，便于引用）
  db.prepare('INSERT OR IGNORE INTO teams (id, name) VALUES (?, ?)').run(TEAM.id, TEAM.name);

  const hash = bcrypt.hashSync('123456', 10);

  // 组长
  db.prepare(
    `INSERT OR IGNORE INTO users (id, username, password_hash, name, role, team_id, hire_date, status)
     VALUES (?, ?, ?, ?, 'team_lead', ?, ?, 'active')`
  ).run(2, TEAM_LEAD.username, hash, TEAM_LEAD.name, TEAM.id, TEAM_LEAD.hire_date);

  // 团队设置 lead_user_id
  db.prepare('UPDATE teams SET lead_user_id = ? WHERE id = ?').run(2, TEAM.id);

  // 员工
  db.prepare(
    `INSERT OR IGNORE INTO users (id, username, password_hash, name, role, team_id, hire_date, status)
     VALUES (?, ?, ?, ?, 'employee', ?, ?, 'active')`
  ).run(3, EMPLOYEE.username, hash, EMPLOYEE.name, TEAM.id, EMPLOYEE.hire_date);

  // 项目
  db.prepare(
    `INSERT OR IGNORE INTO projects (id, name, type, status) VALUES (?, ?, 'project', 'active')`
  ).run(PROJECT.id, PROJECT.name);

  // 员工年假余额（5 天）
  db.prepare(
    `INSERT OR IGNORE INTO leave_balances (user_id, leave_type, year, entitled_days, used_days)
     VALUES (?, 'annual', ?, 5, 0)`
  ).run(3, year);
}

/**
 * 按用户名登录，返回 { token, user }
 */
function loginAs(user) {
  const request = require('supertest');
  const app = require('../src/app');
  // app 已经被 require 过了；直接用 supertest
  // 但我们需要避免重复 require 带来的内存库重建
  // 所以直接调 auth.generateToken 更稳
  const db = require('../src/config/db');
  const { generateToken } = require('../src/middleware/auth');

  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(user.username);
  if (!row) {
    // 尝试密码登录（走真实 DB）
    const res = request(app).post('/api/auth/login').send({
      username: user.username,
      password: user.password,
    });
    return res.body;
  }
  const token = generateToken(row);
  return { token, user: { id: row.id, username: row.username, name: row.name, role: row.role, team_id: row.team_id } };
}

module.exports = { seed, loginAs, ADMIN, EMPLOYEE, TEAM_LEAD, TEAM, PROJECT };
