const db = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = require('express').Router();

router.get('/', authRequired, (req, res) => {
  const { userId, status } = req.query;
  let sql = `SELECT o.*, u.name AS user_name FROM overtime_units o JOIN users u ON o.user_id = u.id WHERE 1=1`;
  const params = [];
  if (userId) { sql += ' AND o.user_id = ?'; params.push(userId); }
  if (status) { sql += ' AND o.status = ?'; params.push(status); }
  if (req.user.role === 'employee') { sql += ' AND o.user_id = ?'; params.push(req.user.id); }
  sql += ' ORDER BY o.work_date DESC';
  const list = db.prepare(sql).all(...params);
  res.json({ list });
});

router.get('/available/:userId', authRequired, (req, res) => {
  const list = db.prepare(
    `SELECT * FROM overtime_units WHERE user_id = ? AND status = 'approved' ORDER BY work_date ASC`
  ).all(req.params.userId);
  res.json({ list, total: list.length });
});

module.exports = router;
