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
  const { userId, status } = req.query;
  let sql = `SELECT o.*, u.name AS user_name, u.employee_id,
                    o.created_at, o.created_by, o.updated_at, o.updated_by,
                    o.approved_at, o.approved_by, o.rejected_at, o.rejected_by
             FROM overtime_units o JOIN users u ON o.user_id = u.id WHERE 1=1`;
  const params = [];
  if (userId) { sql += ' AND o.user_id = ?'; params.push(userId); }
  if (status) { sql += ' AND o.status = ?'; params.push(status); }
  if (req.user.role === 'employee') { sql += ' AND o.user_id = ?'; params.push(req.user.id); }
  sql += ' ORDER BY o.work_date DESC';
  const list = db.prepare(sql).all(...params);
  res.json({ list });
});

// 导出加班记录
router.get('/export', authRequired, requireRole('manager'), (req, res) => {
  const { userId, status } = req.query;
  let sql = `SELECT o.id, o.user_id, u.name AS user_name, o.work_date, o.hours, o.units_count,
                    o.status, o.request_id,
                    o.created_at, o.created_by, o.updated_at, o.updated_by,
                    o.approved_at, o.approved_by, o.rejected_at, o.rejected_by
             FROM overtime_units o JOIN users u ON o.user_id = u.id WHERE 1=1`;
  const params = [];
  if (userId) { sql += ' AND o.user_id = ?'; params.push(userId); }
  if (status) { sql += ' AND o.status = ?'; params.push(status); }
  sql += ' ORDER BY o.work_date DESC';
  const list = db.prepare(sql).all(...params);

  const columns = ['id', 'user_name', 'work_date', 'hours', 'units_count', 'status', 'created_at', 'created_by', 'updated_at', 'updated_by', 'approved_at', 'approved_by', 'rejected_at', 'rejected_by'];
  const csv = toCSV(columns, list);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=overtime_export.csv');
  res.send('﻿' + csv);
});

router.get('/available/:userId', authRequired, (req, res) => {
  const list = db.prepare(
    `SELECT * FROM overtime_units WHERE user_id = ? AND status = 'approved' ORDER BY work_date ASC`
  ).all(req.params.userId);
  res.json({ list, total: list.length });
});

module.exports = router;
