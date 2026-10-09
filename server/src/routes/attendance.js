const db = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { calcEffectiveHours, isShortage } = require('../utils/businessRules');

const router = require('express').Router();

router.get('/', authRequired, (req, res) => {
  const { yearMonth, userId } = req.query;
  if (!yearMonth) return res.status(400).json({ message: '请指定年月' });
  let targetUserId = userId;
  if (req.user.role === 'employee') targetUserId = req.user.id;
  let list;
  if (!targetUserId) {
    list = db.prepare(`
      SELECT a.*, u.name AS user_name, u.team_id
      FROM attendance_records a
      JOIN users u ON a.user_id = u.id
      WHERE strftime('%Y-%m', a.work_date) = ?
      ORDER BY u.team_id, a.user_id, a.work_date ASC
    `).all(yearMonth);
  } else {
    list = db.prepare(`
      SELECT a.*, u.name AS user_name
      FROM attendance_records a
      JOIN users u ON a.user_id = u.id
      WHERE a.user_id = ? AND strftime('%Y-%m', a.work_date) = ?
      ORDER BY a.work_date ASC
    `).all(targetUserId, yearMonth);
  }
  res.json({ list });
});

router.post('/batch', authRequired, requireRole('manager'), (req, res) => {
  const { yearMonth, records } = req.body;
  if (!yearMonth || !Array.isArray(records)) return res.status(400).json({ message: '参数不合法' });

  const insert = db.prepare(`
    INSERT INTO attendance_records (user_id, work_date, check_in, check_out, effective_hours, is_shortage, remark)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(user_id, work_date) DO UPDATE SET
      check_in=excluded.check_in, check_out=excluded.check_out,
      effective_hours=excluded.effective_hours, is_shortage=excluded.is_shortage, remark=excluded.remark
  `);

  const tx = db.transaction((rows) => {
    for (const r of rows) {
      const effective = calcEffectiveHours(r.check_in, r.check_out);
      const shortage = isShortage(effective) ? 1 : 0;
      insert.run(r.user_id, `${yearMonth}-${String(r.day).padStart(2, '0')}`, r.check_in || null, r.check_out || null, effective, shortage, r.remark || null);
    }
  });
  tx(records);

  db.prepare('INSERT INTO audit_logs (user_id, action, detail) VALUES (?,?,?)').run(
    req.user.id, 'batch_attendance', `录入 ${yearMonth} 考勤 ${records.length} 条`
  );
  res.json({ message: `成功录入 ${records.length} 条考勤记录` });
});

router.put('/offset', authRequired, requireRole('manager'), (req, res) => {
  const { userId, date, offsetType, offsetUnits, overtimeUnitIds } = req.body;
  // offsetType: 'overtime' | 'annual_leave' | 'compensatory_leave'
  // overtimeUnitIds: 选择的加班条目ID数组（调休时使用）

  if (!userId || !date) return res.status(400).json({ message: '缺少用户ID或日期' });

  const units = Number(offsetUnits) || 0;
  if (units <= 0) return res.status(400).json({ message: '抵扣数量必须大于 0' });

  const daysToConsume = units * 0.5; // 需要抵扣的天数
  const year = new Date(date).getFullYear();

  // 查找或创建考勤记录
  let record = db.prepare('SELECT * FROM attendance_records WHERE user_id = ? AND work_date = ?').get(userId, date);
  let recordId = record ? record.id : null;

  try {
    if (offsetType === 'overtime') {
      // 加班单位抵扣
      const available = db.prepare(
        `SELECT id FROM overtime_units WHERE user_id = ? AND status = 'approved' ORDER BY work_date ASC LIMIT ?`
      ).all(userId, units);
      if (available.length < units) {
        return res.status(400).json({ message: `可用加班单位不足，当前可用 ${available.length} 个` });
      }
      const tx = db.transaction(() => {
        for (const u of available) {
          db.prepare("UPDATE overtime_units SET status='used' WHERE id=?").run(u.id);
        }
        if (recordId) {
          db.prepare('UPDATE attendance_records SET offset_type=?, offset_units=?, is_shortage=0 WHERE id=?').run('overtime', units, recordId);
        } else {
          const info = db.prepare('INSERT INTO attendance_records (user_id, work_date, effective_hours, is_shortage, offset_type, offset_units) VALUES (?,?,0,0,?,?)').run(userId, date, 'overtime', units);
          recordId = info.lastInsertRowid;
        }
      });
      tx();
    } else if (offsetType === 'annual_leave') {
      // 年假抵扣
      const bal = db.prepare(
        `SELECT * FROM leave_balances WHERE user_id=? AND leave_type='annual' AND year=?`
      ).get(userId, year);
      if (!bal || (bal.entitled_days - bal.used_days) < daysToConsume) {
        return res.status(400).json({ message: '年假余额不足' });
      }
      const tx = db.transaction(() => {
        db.prepare('UPDATE leave_balances SET used_days = used_days + ? WHERE id = ?').run(daysToConsume, bal.id);
        if (recordId) {
          db.prepare('UPDATE attendance_records SET offset_type=?, offset_units=?, is_shortage=0 WHERE id=?').run('annual_leave', units, recordId);
        } else {
          const info = db.prepare('INSERT INTO attendance_records (user_id, work_date, effective_hours, is_shortage, offset_type, offset_units) VALUES (?,?,0,0,?,?)').run(userId, date, 'annual_leave', units);
          recordId = info.lastInsertRowid;
        }
        // 创建请假记录（用于请假明细展示）
        db.prepare(`INSERT INTO attendance_requests (user_id, type, leave_type_used, start_date, end_date, days, status, reason, manager_id, manager_comment, manager_time) VALUES (?, 'leave', 'annual', ?, ?, ?, 'entered', '考勤抵扣', ?, '管理员抵扣', datetime('now','localtime'))`).run(userId, date, date, daysToConsume, req.user.id);
      });
      tx();
    } else if (offsetType === 'compensatory_leave') {
      // 调休抵扣 - 需要选择加班条目
      if (!Array.isArray(overtimeUnitIds) || overtimeUnitIds.length === 0) {
        return res.status(400).json({ message: '调休抵扣需要选择加班条目' });
      }
      const placeholders = overtimeUnitIds.map(() => '?').join(',');
      const units = db.prepare(
        `SELECT * FROM overtime_units WHERE id IN (${placeholders}) AND user_id = ? AND status = 'approved'`
      ).all(...overtimeUnitIds, userId);
      if (units.length !== overtimeUnitIds.length) {
        return res.status(400).json({ message: '选择的加班条目不可用' });
      }
      const totalDays = units.reduce((sum, u) => sum + u.units_count * 0.5, 0);
      if (Math.abs(totalDays - daysToConsume) > 0.01) {
        return res.status(400).json({ message: `选择的加班条目累计可抵扣 ${totalDays} 天，与需要抵扣的 ${daysToConsume} 天不匹配` });
      }
      const tx = db.transaction(() => {
        for (const u of units) {
          db.prepare("UPDATE overtime_units SET status='used', leave_type_mark='compensatory' WHERE id=?").run(u.id);
        }
        db.prepare('UPDATE leave_balances SET used_days = used_days + ? WHERE user_id = ? AND leave_type = ? AND year = ?').run(daysToConsume, userId, 'compensatory', year);
        if (recordId) {
          db.prepare('UPDATE attendance_records SET offset_type=?, offset_units=?, is_shortage=0 WHERE id=?').run('compensatory_leave', units.length, recordId);
        } else {
          const info = db.prepare('INSERT INTO attendance_records (user_id, work_date, effective_hours, is_shortage, offset_type, offset_units) VALUES (?,?,0,0,?,?)').run(userId, date, 'compensatory_leave', units.length);
          recordId = info.lastInsertRowid;
        }
        // 创建请假记录（用于请假明细展示）
        db.prepare(`INSERT INTO attendance_requests (user_id, type, leave_type_used, start_date, end_date, days, status, reason, manager_id, manager_comment, manager_time) VALUES (?, 'leave', 'compensatory', ?, ?, ?, 'entered', '考勤抵扣', ?, '管理员抵扣', datetime('now','localtime'))`).run(userId, date, date, daysToConsume, req.user.id);
      });
      tx();
    } else {
      return res.status(400).json({ message: '抵扣类型不合法' });
    }
  } catch (err) {
    return res.status(400).json({ message: err.message || '抵扣失败' });
  }

  db.prepare('INSERT INTO audit_logs (user_id, action, detail) VALUES (?,?,?)').run(
    req.user.id, 'offset_attendance', `用户${userId} ${date} 用 ${offsetType} 抵扣 ${units}`
  );
  res.json({ message: '抵扣成功' });
});

module.exports = router;
