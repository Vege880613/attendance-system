const db = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = require('express').Router();

router.get('/', authRequired, (req, res) => {
  const list = db.prepare(`
    SELECT t.*, u.name AS lead_name,
      (SELECT COUNT(*) FROM users WHERE team_id = t.id AND status = 'active') AS member_count
    FROM teams t LEFT JOIN users u ON t.lead_user_id = u.id
    ORDER BY t.id ASC
  `).all();
  res.json({ list });
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
  const info = db.prepare('INSERT INTO teams (name, lead_user_id) VALUES (?,?)').run(name, lead_user_id || null);
  res.json({ id: info.lastInsertRowid, message: '创建成功' });
});

router.put('/:id', authRequired, requireRole('manager'), (req, res) => {
  const { name, lead_user_id } = req.body;
  db.prepare('UPDATE teams SET name=?, lead_user_id=? WHERE id=?').run(name, lead_user_id || null, req.params.id);
  res.json({ message: '更新成功' });
});

module.exports = router;
