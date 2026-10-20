const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = require('express').Router();

// 辅助函数：生成CSV
function toCSV(columns, rows) {
  const header = columns.join(',');
  const lines = rows.map(row => columns.map(c => {
    let val = row[c];
    if (val === null || val === undefined) val = '';
    val = String(val).replace(/"/g, '""');
    return `"${val}"`;
  }).join(','));
  return [header, ...lines].join('\n');
}

router.get('/', authRequired, (req, res) => {
  const { keyword, teamId, role, status } = req.query;
  let sql = `SELECT u.id, u.username, u.name, u.role, u.team_id, u.hire_date, u.status, u.employee_id, u.company_hire_date,
                    u.created_at, u.created_by, u.updated_at, u.updated_by, t.name AS team_name
             FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE 1=1`;
  const params = [];
  if (keyword) {
    sql += ' AND (u.name LIKE ? OR u.username LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (teamId) { sql += ' AND u.team_id = ?'; params.push(teamId); }
  if (role) { sql += ' AND u.role = ?'; params.push(role); }
  if (status) { sql += ' AND u.status = ?'; params.push(status); }
  if (req.user.role === 'team_lead') {
    const me = db.prepare('SELECT team_id FROM users WHERE id = ?').get(req.user.id);
    sql += ' AND u.team_id = ?';
    params.push(me.team_id);
  }
  sql += ' ORDER BY u.id ASC';
  const list = db.prepare(sql).all(...params);
  res.json({ list });
});

// 导出用户列表
router.get('/export', authRequired, requireRole('manager'), (req, res) => {
  const { keyword, teamId, role, status } = req.query;
  let sql = `SELECT u.id, u.username, u.name, u.role, u.team_id, u.hire_date, u.status, u.employee_id,
                    u.created_at, u.created_by, u.updated_at, u.updated_by, t.name AS team_name
             FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE 1=1`;
  const params = [];
  if (keyword) {
    sql += ' AND (u.name LIKE ? OR u.username LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (teamId) { sql += ' AND u.team_id = ?'; params.push(teamId); }
  if (role) { sql += ' AND u.role = ?'; params.push(role); }
  if (status) { sql += ' AND u.status = ?'; params.push(status); }
  sql += ' ORDER BY u.id ASC';
  const list = db.prepare(sql).all(...params);

  const columns = ['id', 'username', 'name', 'role', 'team_name', 'hire_date', 'status', 'created_at', 'created_by', 'updated_at', 'updated_by'];
  const csv = toCSV(columns, list);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=users_export.csv');
  res.send('﻿' + csv); // BOM for Excel
});

router.post('/', authRequired, requireRole('manager'), (req, res) => {
  const { username, password, name, role, team_id, hire_date } = req.body;
  if (!username || !password || !name || !hire_date) {
    return res.status(400).json({ message: '缺少必要字段' });
  }
  const hash = bcrypt.hashSync(password, 10);
  try {
    const info = db.prepare(
      'INSERT INTO users (username, password_hash, name, role, team_id, hire_date, status, created_by) VALUES (?,?,?,?,?,?,?,?)'
    ).run(username, hash, name, role || 'employee', team_id || null, hire_date, 'active', req.user.id);
    db.prepare('INSERT INTO audit_logs (user_id, action, detail) VALUES (?,?,?)').run(
      req.user.id, 'create_user', `新增员工 ${name}(${username})`
    );
    res.json({ id: info.lastInsertRowid, message: '创建成功' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ message: '用户名已存在' });
    throw err;
  }
});

router.put('/:id', authRequired, requireRole('manager'), (req, res) => {
  const { name, role, team_id, hire_date, employee_id, company_hire_date } = req.body;
  db.prepare('UPDATE users SET name=?, role=?, team_id=?, hire_date=?, employee_id=?, company_hire_date=?, updated_at=datetime(\'now\',\'localtime\'), updated_by=? WHERE id=?').run(
    name, role, team_id || null, hire_date, employee_id || null, company_hire_date || null, req.user.id, req.params.id
  );
  db.prepare('INSERT INTO audit_logs (user_id, action, detail) VALUES (?,?,?)').run(
    req.user.id, 'update_user', `编辑员工 ID=${req.params.id}`
  );
  res.json({ message: '更新成功' });
});

router.put('/:id/status', authRequired, requireRole('manager'), (req, res) => {
  const { status } = req.body;
  if (!['active', 'resigned'].includes(status)) return res.status(400).json({ message: '状态不合法' });
  db.prepare("UPDATE users SET status=?, updated_at=datetime('now','localtime'), updated_by=? WHERE id=?").run(
    status, req.user.id, req.params.id
  );
  db.prepare('INSERT INTO audit_logs (user_id, action, detail) VALUES (?,?,?)').run(
    req.user.id, 'change_status', `员工 ID=${req.params.id} 状态改为 ${status}`
  );
  res.json({ message: '状态更新成功' });
});

module.exports = router;
