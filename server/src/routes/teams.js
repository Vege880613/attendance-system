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
  const list = db.prepare(`
    SELECT t.*, u.name AS lead_name,
      (SELECT COUNT(*) FROM users WHERE team_id = t.id AND status = 'active') AS member_count
    FROM teams t LEFT JOIN users u ON t.lead_user_id = u.id
    ORDER BY t.id ASC
  `).all();
  res.json({ list });
});

// 导出团队列表
router.get('/export', authRequired, requireRole('manager'), (req, res) => {
  const list = db.prepare(`
    SELECT t.id, t.name, u.name AS lead_name, t.created_at, t.created_by, t.updated_at, t.updated_by,
      (SELECT COUNT(*) FROM users WHERE team_id = t.id AND status = 'active') AS member_count
    FROM teams t LEFT JOIN users u ON t.lead_user_id = u.id
    ORDER BY t.id ASC
  `).all();

  const columns = ['id', 'name', 'lead_name', 'member_count', 'created_at', 'created_by', 'updated_at', 'updated_by'];
  const csv = toCSV(columns, list);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=teams_export.csv');
  res.send('﻿' + csv);
});

router.get('/:id/members', authRequired, (req, res) => {
  const list = db.prepare(
    `SELECT id, username, name, role, hire_date, status FROM users WHERE team_id = ? ORDER BY id ASC`
  ).all(req.params.id);
  res.json({ list });
});

router.post('/', authRequired, requireRole('manager'), (req, res) => {
  const { name, lead_user_id } = req.body;
  if (!name) return res.status(400).json({ message: '班组名称不能为空' });
  const info = db.prepare('INSERT INTO teams (name, lead_user_id, created_by) VALUES (?,?,?)').run(name, lead_user_id || null, req.user.id);
  res.json({ id: info.lastInsertRowid, message: '创建成功' });
});

router.put('/:id', authRequired, requireRole('manager'), (req, res) => {
  const { name, lead_user_id } = req.body;
  db.prepare("UPDATE teams SET name=?, lead_user_id=?, updated_at=datetime('now','localtime'), updated_by=? WHERE id=?").run(name, lead_user_id || null, req.user.id, req.params.id);
  res.json({ message: '更新成功' });
});

module.exports = router;
