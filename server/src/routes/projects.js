const db = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = require('express').Router();

// 项目列表
router.get('/', authRequired, (req, res) => {
  const { type, status } = req.query;
  let sql = 'SELECT * FROM projects WHERE 1=1';
  const params = [];
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY id DESC';
  const list = db.prepare(sql).all(...params);
  res.json({ list });
});

// 创建项目（管理人员）
router.post('/', authRequired, requireRole('manager'), (req, res) => {
  const { name, type, description } = req.body;
  if (!name) return res.status(400).json({ message: '项目名称不能为空' });
  const info = db.prepare(
    'INSERT INTO projects (name, type, description) VALUES (?,?,?)'
  ).run(name, type || 'project', description || null);
  db.prepare('INSERT INTO audit_logs (user_id, action, detail) VALUES (?,?,?)').run(
    req.user.id, 'create_project', `创建项目 ${name}`
  );
  res.json({ id: info.lastInsertRowid, message: '创建成功' });
});

// 编辑项目
router.put('/:id', authRequired, requireRole('manager'), (req, res) => {
  const { name, type, description, status } = req.body;
  db.prepare('UPDATE projects SET name=?, type=?, description=?, status=? WHERE id=?').run(
    name, type, description || null, status, req.params.id
  );
  res.json({ message: '更新成功' });
});

module.exports = router;
