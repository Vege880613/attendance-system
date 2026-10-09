const db = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = require('express').Router();

// 获取节假日列表
router.get('/', authRequired, (req, res) => {
  const { year } = req.query;
  let sql = 'SELECT * FROM holidays WHERE 1=1';
  const params = [];

  if (year) {
    sql += ' AND year = ?';
    params.push(year);
  }

  sql += ' ORDER BY date ASC';
  const list = db.prepare(sql).all(...params);
  res.json({ list });
});

// 添加节假日（管理人员）
router.post('/', authRequired, requireRole('manager'), (req, res) => {
  const { date, name, type, year } = req.body;
  if (!date || !name || !type || !year) {
    return res.status(400).json({ message: '缺少必要字段' });
  }

  try {
    const info = db.prepare(
      'INSERT INTO holidays (date, name, type, year) VALUES (?, ?, ?, ?)'
    ).run(date, name, type, year);
    res.json({ id: info.lastInsertRowid, message: '添加成功' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ message: '该日期已存在' });
    }
    throw err;
  }
});

// 删除节假日（管理人员）
router.delete('/:id', authRequired, requireRole('manager'), (req, res) => {
  db.prepare('DELETE FROM holidays WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

module.exports = router;
