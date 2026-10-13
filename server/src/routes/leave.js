const db = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { annualLeaveDays, companyTenureYears, canUseAnnualLeave } = require('../utils/businessRules');

const router = require('express').Router();

router.get('/:userId', authRequired, (req, res) => {
  const userId = req.params.userId;
  if (req.user.role === 'employee' && Number(userId) !== req.user.id) {
    return res.status(403).json({ message: '无权查看' });
  }
  const year = new Date().getFullYear();
  let list = db.prepare('SELECT * FROM leave_balances WHERE user_id = ? AND year = ?').all(userId, year);

  // 获取用户入职本司时间
  const user = db.prepare('SELECT company_hire_date FROM users WHERE id = ?').get(userId);
  const companyHireDate = user ? user.company_hire_date : null;
  const tenureYears = companyTenureYears(companyHireDate, year);
  const canUseAnnual = canUseAnnualLeave(companyHireDate, year);

  // 动态计算调休余额（基于全部加班单位，不仅仅是可用的）
  const allOvertime = db.prepare(
    `SELECT COUNT(*) as cnt FROM overtime_units WHERE user_id = ? AND strftime('%Y', work_date) = ?`
  ).get(userId, String(year));

  // 计算全部加班单位对应的调休天数：3单位=1天，1-2单位=0.5天
  const totalUnits = allOvertime.cnt;
  const overtimeDays = Math.floor(totalUnits / 3) + (totalUnits % 3 > 0 ? 0.5 : 0);

  // 获取已使用的调休天数（只计算重置后的）
  const usedResult = db.prepare(
    `SELECT COALESCE(SUM(days), 0) as total FROM attendance_requests WHERE user_id = ? AND leave_type_used = 'compensatory' AND status = 'entered' AND strftime('%Y', start_date) = ?`
  ).get(userId, String(year));
  const usedDays = usedResult.total;

  // 更新或插入调休余额记录
  const compIndex = list.findIndex(b => b.leave_type === 'compensatory');
  if (overtimeDays > 0 || usedDays > 0) {
    if (compIndex >= 0) {
      // 更新现有记录
      db.prepare('UPDATE leave_balances SET entitled_days = ?, used_days = ?, updated_at=datetime(\'now\',\'localtime\'), updated_by=? WHERE id = ?').run(overtimeDays, usedDays, req.user.id, list[compIndex].id);
      list[compIndex].entitled_days = overtimeDays;
      list[compIndex].used_days = usedDays;
    } else {
      // 插入新记录
      const info = db.prepare(
        `INSERT INTO leave_balances (user_id, leave_type, year, entitled_days, used_days, created_by) VALUES (?, 'compensatory', ?, ?, ?, ?)`
      ).run(userId, year, overtimeDays, usedDays, req.user.id);
      list.push({
        id: info.lastInsertRowid,
        user_id: userId,
        leave_type: 'compensatory',
        year,
        entitled_days: overtimeDays,
        used_days: usedDays,
        created_by: req.user.id
      });
    }
  } else if (compIndex < 0) {
    // 没有加班也没有使用记录，确保有一条0记录
    const info = db.prepare(
      `INSERT INTO leave_balances (user_id, leave_type, year, entitled_days, used_days, created_by) VALUES (?, 'compensatory', ?, 0, 0, ?)`
    ).run(userId, year, req.user.id);
    list.push({
      id: info.lastInsertRowid,
      user_id: userId,
      leave_type: 'compensatory',
      year,
      entitled_days: 0,
      used_days: 0,
      created_by: req.user.id
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

  res.json({ list, year, companyHireDate, tenureYears, canUseAnnual });
});

// 导出假期余额
router.get('/export', authRequired, requireRole('manager'), (req, res) => {
  const year = new Date().getFullYear();
  const list = db.prepare(`
    SELECT lb.user_id, u.name AS user_name, lb.leave_type, lb.entitled_days, lb.used_days,
           lb.reset_used_days, lb.reset_at, lb.created_at, lb.created_by, lb.updated_at, lb.updated_by
    FROM leave_balances lb
    JOIN users u ON lb.user_id = u.id
    WHERE lb.year = ?
    ORDER BY u.team_id, u.id, lb.leave_type
  `).all(year);

  const columns = ['user_name', 'leave_type', 'entitled_days', 'used_days', 'reset_used_days', 'reset_at', 'created_at', 'created_by', 'updated_at', 'updated_by'];
  const csv = toCSV(columns, list);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=leave_balances_export.csv');
  res.send('﻿' + csv);
});

router.get('/:userId', authRequired, (req, res) => {
  const userId = req.params.userId;
  if (req.user.role === 'employee' && Number(userId) !== req.user.id) {
    return res.status(403).json({ message: '无权查看' });
  }
  const year = new Date().getFullYear();

  // 动态计算调休余额（基于可用加班单位）
  const allOvertime = db.prepare(
    `SELECT COUNT(*) as cnt FROM overtime_units WHERE user_id = ? AND strftime('%Y', work_date) = ?`
  ).get(userId, String(year));

  // 计算全部加班单位对应的调休天数：3单位=1天，1-2单位=0.5天
  const totalUnits = allOvertime.cnt;
  const overtimeDays = Math.floor(totalUnits / 3) + (totalUnits % 3 > 0 ? 0.5 : 0);

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
    `SELECT id, hire_date, company_hire_date FROM users WHERE status = 'active' AND role IN ('employee','team_lead','manager')`
  ).all();

  const adjustMap = {};
  if (Array.isArray(adjustments)) adjustments.forEach(a => { adjustMap[a.userId] = a.entitledDays; });

  const upsert = db.prepare(`
    INSERT INTO leave_balances (user_id, leave_type, year, entitled_days, used_days, reset_used_days, reset_at, created_by)
    VALUES (?, 'annual', ?, ?, 0, 0, NULL, ?)
    ON CONFLICT(user_id, leave_type, year) DO UPDATE SET
      entitled_days=excluded.entitled_days,
      reset_used_days=leave_balances.used_days,
      used_days=0,
      reset_at=datetime('now','localtime'),
      updated_by=excluded.created_by
  `);

  const tx = db.transaction(() => {
    // 标记重置前的假期使用记录
    db.prepare(`
      UPDATE attendance_records
      SET is_reset_before = 1
      WHERE user_id IN (SELECT id FROM users WHERE status = 'active' AND role IN ('employee','team_lead','manager'))
        AND offset_type = 'annual_leave'
    `).run();

    // 标记重置前的请假申请记录
    db.prepare(`
      UPDATE attendance_requests
      SET is_reset_before = 1
      WHERE user_id IN (SELECT id FROM users WHERE status = 'active' AND role IN ('employee','team_lead','manager'))
        AND type = 'leave'
        AND status = 'entered'
    `).run();

    // 初始化年假余额
    for (const u of users) {
      const entitled = adjustMap[u.id] !== undefined ? adjustMap[u.id] : annualLeaveDays(u.hire_date, targetYear, u.company_hire_date);
      upsert.run(u.id, targetYear, entitled, req.user.id);
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

module.exports = router;
