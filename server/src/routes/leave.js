const db = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { annualLeaveDays } = require('../utils/businessRules');

const router = require('express').Router();

router.get('/:userId', authRequired, (req, res) => {
  const userId = req.params.userId;
  if (req.user.role === 'employee' && Number(userId) !== req.user.id) {
    return res.status(403).json({ message: '无权查看' });
  }
  const year = new Date().getFullYear();
  let list = db.prepare('SELECT * FROM leave_balances WHERE user_id = ? AND year = ?').all(userId, year);

  // 动态计算调休余额（基于可用加班单位）
  const availableOvertime = db.prepare(
    `SELECT COUNT(*) as cnt FROM overtime_units WHERE user_id = ? AND status = 'approved' AND strftime('%Y', work_date) = ?`
  ).get(userId, String(year));

  const overtimeDays = availableOvertime.cnt * 0.5;

  // 获取已使用的调休天数
  const usedResult = db.prepare(
    `SELECT COALESCE(SUM(days), 0) as total FROM attendance_requests WHERE user_id = ? AND leave_type_used = 'compensatory' AND status = 'entered' AND strftime('%Y', start_date) = ?`
  ).get(userId, String(year));
  const usedDays = usedResult.total;

  // 更新或插入调休余额记录
  const compIndex = list.findIndex(b => b.leave_type === 'compensatory');
  if (overtimeDays > 0 || usedDays > 0) {
    if (compIndex >= 0) {
      // 更新现有记录
      db.prepare('UPDATE leave_balances SET entitled_days = ?, used_days = ? WHERE id = ?').run(overtimeDays, usedDays, list[compIndex].id);
      list[compIndex].entitled_days = overtimeDays;
      list[compIndex].used_days = usedDays;
    } else {
      // 插入新记录
      const info = db.prepare(
        `INSERT INTO leave_balances (user_id, leave_type, year, entitled_days, used_days) VALUES (?, 'compensatory', ?, ?, ?)`
      ).run(userId, year, overtimeDays, usedDays);
      list.push({
        id: info.lastInsertRowid,
        user_id: userId,
        leave_type: 'compensatory',
        year,
        entitled_days: overtimeDays,
        used_days: usedDays
      });
    }
  } else if (compIndex < 0) {
    // 没有加班也没有使用记录，确保有一条0记录
    const info = db.prepare(
      `INSERT INTO leave_balances (user_id, leave_type, year, entitled_days, used_days) VALUES (?, 'compensatory', ?, 0, 0)`
    ).run(userId, year);
    list.push({
      id: info.lastInsertRowid,
      user_id: userId,
      leave_type: 'compensatory',
      year,
      entitled_days: 0,
      used_days: 0
    });
  }

  // 确保 other 和 business_trip 也有一条记录（显示为无余额限制）
  ['business_trip', 'other'].forEach(type => {
    if (!list.find(b => b.leave_type === type)) {
      list.push({
        id: null,
        user_id: userId,
        leave_type: type,
        year,
        entitled_days: 0,
        used_days: 0
      });
    }
  });

  res.json({ list, year });
});

router.post('/annual/init', authRequired, requireRole('manager'), (req, res) => {
  const { year, adjustments } = req.body;
  const targetYear = year || new Date().getFullYear();
  const users = db.prepare(
    `SELECT id, hire_date FROM users WHERE status = 'active' AND role IN ('employee','team_lead','manager')`
  ).all();

  const adjustMap = {};
  if (Array.isArray(adjustments)) adjustments.forEach(a => { adjustMap[a.userId] = a.entitledDays; });

  const upsert = db.prepare(`
    INSERT INTO leave_balances (user_id, leave_type, year, entitled_days, used_days)
    VALUES (?, 'annual', ?, ?, 0)
    ON CONFLICT(user_id, leave_type, year) DO UPDATE SET entitled_days=excluded.entitled_days
  `);

  const tx = db.transaction(() => {
    for (const u of users) {
      const entitled = adjustMap[u.id] !== undefined ? adjustMap[u.id] : annualLeaveDays(u.hire_date, targetYear);
      upsert.run(u.id, targetYear, entitled);
    }
  });
  tx(users);

  db.prepare('INSERT INTO audit_logs (user_id, action, detail) VALUES (?,?,?)').run(
    req.user.id, 'annual_init', `${targetYear} 年年假初始化`
  );
  res.json({ message: `${targetYear} 年年假初始化完成` });
});

router.post('/annual/clear', authRequired, requireRole('manager'), (req, res) => {
  const { year } = req.body;
  const targetYear = year || new Date().getFullYear() - 1;
  db.prepare('DELETE FROM leave_balances WHERE year = ?').run(targetYear);
  db.prepare('INSERT INTO audit_logs (user_id, action, detail) VALUES (?,?,?)').run(
    req.user.id, 'annual_clear', `清理 ${targetYear} 年度假期`
  );
  res.json({ message: `${targetYear} 年度假期已清理` });
});

module.exports = router;
