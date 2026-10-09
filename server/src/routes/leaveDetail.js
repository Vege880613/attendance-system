const db = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = require('express').Router();

// 假期明细 - 查看某个用户的请假记录
router.get('/detail/:userId', authRequired, (req, res) => {
  const userId = req.params.userId;
  const { year, leaveType } = req.query;

  // 员工只能看自己
  if (req.user.role === 'employee' && Number(userId) !== req.user.id) {
    return res.status(403).json({ message: '无权查看' });
  }

  const targetYear = year || new Date().getFullYear();

  // 年假明细
  let sql = `
    SELECT r.id, r.type, r.subtype, r.start_date, r.end_date, r.days,
           r.status, r.reason, r.team_lead_comment, r.manager_comment,
           u.name AS user_name, 'annual' AS leave_type
    FROM attendance_requests r
    JOIN users u ON r.user_id = u.id
    WHERE r.user_id = ? AND r.leave_type_used = 'annual'
      AND strftime('%Y', r.start_date) = ?
      AND r.status = 'entered'
  `;
  const params = [userId, String(targetYear)];

  if (leaveType && leaveType !== 'annual') {
    sql = `
      SELECT r.id, r.type, r.subtype, r.start_date, r.end_date, r.days,
             r.status, r.reason, r.team_lead_comment, r.manager_comment,
             u.name AS user_name, ? AS leave_type
      FROM attendance_requests r
      JOIN users u ON r.user_id = u.id
      WHERE r.user_id = ? AND r.leave_type_used = ?
        AND strftime('%Y', r.start_date) = ?
        AND r.status = 'entered'
    `;
    params.length = 0;
    params.push(leaveType, userId, leaveType, String(targetYear));
  }

  sql += ' ORDER BY r.start_date DESC';

  const details = db.prepare(sql).all(...params);
  res.json({ list: details, year: targetYear });
});

// 加班明细 - 查看某个用户的加班记录
router.get('/overtime-detail/:userId', authRequired, (req, res) => {
  const userId = req.params.userId;
  const { year, yearMonth } = req.query;

  if (req.user.role === 'employee' && Number(userId) !== req.user.id) {
    return res.status(403).json({ message: '无权查看' });
  }

  const targetYear = year || new Date().getFullYear();

  // 加班记录（来自 overtime_units 和 attendance_requests）
  let sql = `
    SELECT o.id, o.work_date, o.hours, o.units_count, o.status,
           o.leave_request_id, o.leave_type_mark, o.leave_dates,
           u.name AS user_name, r.reason, r.team_lead_comment, r.start_date AS leave_start, r.end_date AS leave_end, p.name AS project_name
    FROM overtime_units o
    JOIN users u ON o.user_id = u.id
    LEFT JOIN attendance_requests r ON o.request_id = r.id
    LEFT JOIN projects p ON r.project_id = p.id
    WHERE o.user_id = ? AND strftime('%Y', o.work_date) = ?
  `;
  const params = [userId, String(targetYear)];

  if (yearMonth) {
    sql = sql.replace("strftime('%Y', o.work_date) = ?", "strftime('%Y-%m', o.work_date) = ?");
    params[1] = yearMonth;
  }

  sql += ' ORDER BY o.work_date DESC';

  const details = db.prepare(sql).all(...params);

  // 汇总统计
  const summary = db.prepare(`
    SELECT
      COUNT(*) AS total_units,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS available_units,
      SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) AS used_units,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_units
    FROM overtime_units
    WHERE user_id = ? AND strftime('%Y', work_date) = ?
  `).all(userId, String(targetYear));

  res.json({ list: details, summary: summary[0], year: targetYear });
});

module.exports = router;
