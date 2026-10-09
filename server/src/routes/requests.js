const db = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { hoursToUnits } = require('../utils/businessRules');

const router = require('express').Router();

router.post('/', authRequired, (req, res) => {
  const { type, subtype, start_date, end_date, days, overtime_units_used, leave_type_used, reason, project_id, overtime_unit_ids, annual_days } = req.body;
  if (!type || !start_date || !end_date) return res.status(400).json({ message: '缺少必要字段' });

  // 加班申请必须选择项目
  if (type === 'overtime' && !project_id) {
    return res.status(400).json({ message: '加班申请必须选择项目或系统' });
  }

  // 调休申请必须选择加班条目
  if ((leave_type_used === 'compensatory' || leave_type_used === 'mixed') && type === 'leave') {
    if (!Array.isArray(overtime_unit_ids) || overtime_unit_ids.length === 0) {
      return res.status(400).json({ message: '调休申请必须选择对应的加班条目' });
    }
    // 验证加班条目是否可用且属于该用户
    const placeholders = overtime_unit_ids.map(() => '?').join(',');
    const units = db.prepare(
      `SELECT * FROM overtime_units WHERE id IN (${placeholders}) AND user_id = ? AND status = 'approved'`
    ).all(...overtime_unit_ids, req.user.id);

    if (units.length !== overtime_unit_ids.length) {
      return res.status(400).json({ message: '选择的加班条目不可用或不属于您' });
    }

    // 验证累计时长是否等于休假时长
    // 计算规则：1个加班单位=0.5天，但1整天需要3个单位（不是2个）
    const totalUnits = units.reduce((sum, u) => sum + u.units_count, 0);
    const totalDays = Math.floor(totalUnits / 3) + (totalUnits % 3 > 0 ? 0.5 : 0);
    if (Math.abs(totalDays - Number(days)) > 0.01) {
      return res.status(400).json({
        message: `选择的加班条目累计可抵扣 ${totalDays} 天，与申请天数 ${days} 天不匹配`
      });
    }
  }

  // 年假余额校验
  if (type === 'leave' && leave_type_used === 'annual') {
    const year = new Date(start_date).getFullYear();
    const bal = db.prepare(`SELECT * FROM leave_balances WHERE user_id=? AND leave_type='annual' AND year=?`).get(req.user.id, year);
    const balDays = bal ? bal.entitled_days - bal.used_days : 0;
    if (balDays < Number(days)) {
      return res.status(400).json({ message: `年假余额不足，当前剩余 ${balDays} 天` });
    }
  }

  const me = db.prepare('SELECT team_id FROM users WHERE id = ?').get(req.user.id);
  const team = me && me.team_id ? db.prepare('SELECT lead_user_id FROM teams WHERE id = ?').get(me.team_id) : null;
  const teamLeadId = team ? team.lead_user_id : null;

  // 判断是否需要部门经理审批（请假超过3天）
  const needsDeptManager = type === 'leave' && Number(days) > 3;

  const info = db.prepare(
    `INSERT INTO attendance_requests
      (user_id, type, subtype, start_date, end_date, days, overtime_units_used, leave_type_used, reason, team_lead_id, project_id, needs_dept_manager)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(req.user.id, type, subtype || null, start_date, end_date, days || 0, overtime_units_used || 0, leave_type_used || 'none', reason || null, teamLeadId, project_id || null, needsDeptManager ? 1 : 0);

  db.prepare('INSERT INTO audit_logs (user_id, action, detail) VALUES (?,?,?)').run(
    req.user.id, 'create_request', `发起 ${type} 申请 ID=${info.lastInsertRowid}`
  );
  res.json({ id: info.lastInsertRowid, message: '申请已提交' });
});

router.get('/mine', authRequired, (req, res) => {
  const list = db.prepare(
    `SELECT r.*, u.name AS user_name, tl.name AS team_lead_name, m.name AS manager_name
     FROM attendance_requests r
     JOIN users u ON r.user_id = u.id
     LEFT JOIN users tl ON r.team_lead_id = tl.id
     LEFT JOIN users m ON r.manager_id = m.id
     WHERE r.user_id = ?
     ORDER BY r.id DESC`
  ).all(req.user.id);
  res.json({ list });
});

router.get('/review', authRequired, requireRole('team_lead', 'manager'), (req, res) => {
  const list = db.prepare(
    `SELECT r.*, u.name AS user_name, u.team_id
     FROM attendance_requests r
     JOIN users u ON r.user_id = u.id
     WHERE r.status = 'pending' AND r.team_lead_id = ?
     ORDER BY r.id ASC`
  ).all(req.user.id);

  // 添加假期余额信息
  const enrichedList = list.map(item => {
    if (item.type === 'leave' && (item.leave_type_used === 'annual' || item.leave_type_used === 'compensatory')) {
      const year = new Date(item.start_date).getFullYear();
      const bal = db.prepare(
        `SELECT * FROM leave_balances WHERE user_id=? AND leave_type=? AND year=?`
      ).get(item.user_id, item.leave_type_used, year);
      item.leaveBalance = bal ? Number((bal.entitled_days - bal.used_days).toFixed(1)) : 0;
    }
    // 需要部门经理审批标记
    item.needsDeptManager = item.needs_dept_manager === 1;
    return item;
  });

  res.json({ list: enrichedList });
});

// 部门经理待审批列表
router.get('/dept-review', authRequired, requireRole('dept_manager', 'manager'), (req, res) => {
  const list = db.prepare(
    `SELECT r.*, u.name AS user_name, tl.name AS team_lead_name
     FROM attendance_requests r
     JOIN users u ON r.user_id = u.id
     LEFT JOIN users tl ON r.team_lead_id = tl.id
     WHERE r.status = 'pending_dept'
     ORDER BY r.id ASC`
  ).all();

  // 添加假期余额信息
  const enrichedList = list.map(item => {
    if (item.type === 'leave' && (item.leave_type_used === 'annual' || item.leave_type_used === 'compensatory')) {
      const year = new Date(item.start_date).getFullYear();
      const bal = db.prepare(
        `SELECT * FROM leave_balances WHERE user_id=? AND leave_type=? AND year=?`
      ).get(item.user_id, item.leave_type_used, year);
      item.leaveBalance = bal ? Number((bal.entitled_days - bal.used_days).toFixed(1)) : 0;
    }
    return item;
  });

  res.json({ list: enrichedList });
});

router.get('/confirm', authRequired, requireRole('manager'), (req, res) => {
  const list = db.prepare(
    `SELECT r.*, u.name AS user_name, tl.name AS team_lead_name, dm.name AS dept_manager_name
     FROM attendance_requests r
     JOIN users u ON r.user_id = u.id
     LEFT JOIN users tl ON r.team_lead_id = tl.id
     LEFT JOIN users dm ON r.dept_manager_id = dm.id
     WHERE r.status = 'approved'
     ORDER BY r.id ASC`
  ).all();

  // 添加假期余额信息
  const enrichedList = list.map(item => {
    if (item.type === 'leave' && (item.leave_type_used === 'annual' || item.leave_type_used === 'compensatory')) {
      const year = new Date(item.start_date).getFullYear();
      const bal = db.prepare(
        `SELECT * FROM leave_balances WHERE user_id=? AND leave_type=? AND year=?`
      ).get(item.user_id, item.leave_type_used, year);
      item.leaveBalance = bal ? Number((bal.entitled_days - bal.used_days).toFixed(1)) : 0;
    }
    return item;
  });

  res.json({ list: enrichedList });
});

router.put('/:id/review', authRequired, requireRole('team_lead', 'manager'), (req, res) => {
  const { action, comment } = req.body;
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ message: '操作不合法' });
  const request = db.prepare('SELECT * FROM attendance_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ message: '申请不存在' });
  if (request.status !== 'pending') return res.status(400).json({ message: '该申请已处理' });

  const newStatus = action === 'approve' ?
    (request.needs_dept_manager ? 'pending_dept' : 'approved') : 'rejected';

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE attendance_requests SET status=?, team_lead_id=?, team_lead_comment=?, team_lead_time=datetime('now','localtime') WHERE id=?`
    ).run(newStatus, req.user.id, comment || null, req.params.id);

    if (action === 'approve' && request.type === 'overtime') {
      const overtimeHours = Number(request.days) || 0;
      const unitCount = hoursToUnits(overtimeHours);
      const insert = db.prepare(
        `INSERT INTO overtime_units (user_id, work_date, hours, units_count, status, request_id) VALUES (?,?,?,?,?,?)`
      );
      for (let i = 0; i < unitCount; i++) {
        insert.run(request.user_id, request.start_date, 3.00, 1, 'approved', request.id);
      }
    }
  });
  tx();

  db.prepare('INSERT INTO audit_logs (user_id, action, detail) VALUES (?,?,?)').run(
    req.user.id, 'review_request', `审核申请 ID=${req.params.id} 结果=${newStatus}`
  );
  const msg = action === 'approve' ?
    (request.needs_dept_manager ? '审核通过，待部门经理审批' : '审核通过') : '已驳回';
  res.json({ message: msg });
});

// 部门经理审批（>3天请假）
router.put('/:id/dept-review', authRequired, requireRole('dept_manager', 'manager'), (req, res) => {
  const { action, comment } = req.body;
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ message: '操作不合法' });
  const request = db.prepare('SELECT * FROM attendance_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ message: '申请不存在' });
  if (request.status !== 'pending_dept') return res.status(400).json({ message: '该申请不需要部门经理审批' });

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  db.prepare(
    `UPDATE attendance_requests SET status=?, dept_manager_id=?, dept_manager_comment=?, dept_manager_time=datetime('now','localtime') WHERE id=?`
  ).run(newStatus, req.user.id, comment || null, req.params.id);

  db.prepare('INSERT INTO audit_logs (user_id, action, detail) VALUES (?,?,?)').run(
    req.user.id, 'dept_review', `部门经理审批申请 ID=${req.params.id} 结果=${newStatus}`
  );
  res.json({ message: action === 'approve' ? '审批通过' : '已驳回' });
});

router.put('/:id/confirm', authRequired, requireRole('manager'), (req, res) => {
  const { action, comment } = req.body;
  const request = db.prepare('SELECT * FROM attendance_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ message: '申请不存在' });
  // 可以是 approved（无需部门经理）或 pending_dept（但部门经理已审批的情况不应该出现，因为部门经理审批后状态会变为 approved）
  if (request.status !== 'approved') {
    if (request.status === 'pending_dept') {
      return res.status(400).json({ message: '需要部门经理先审批' });
    }
    return res.status(400).json({ message: '只能确认已审核通过的申请' });
  }

  if (action === 'reject') {
    db.prepare(
      `UPDATE attendance_requests SET status='rejected', manager_id=?, manager_comment=?, manager_time=datetime('now','localtime') WHERE id=?`
    ).run(req.user.id, comment || null, request.id);
    return res.json({ message: '已驳回' });
  }

  const tx = db.transaction(() => {
    if (request.type === 'leave') {
      const days = Number(request.days) || 0;
      const year = new Date(request.start_date).getFullYear();

      if (request.leave_type_used === 'annual') {
        // 年假：扣减年假余额
        const bal = db.prepare(`SELECT * FROM leave_balances WHERE user_id=? AND leave_type='annual' AND year=?`).get(request.user_id, year);
        if (!bal || (bal.entitled_days - bal.used_days) < days) throw new Error('年假余额不足');
        db.prepare('UPDATE leave_balances SET used_days = used_days + ? WHERE id = ?').run(days, bal.id);
        // 创建请假记录（用于请假明细展示）
        db.prepare(`INSERT INTO attendance_requests (user_id, type, leave_type_used, start_date, end_date, days, status, reason, manager_id, manager_comment, manager_time) VALUES (?, 'leave', 'annual', ?, ?, ?, 'entered', '考勤抵扣', ?, '管理员抵扣', datetime('now','localtime'))`).run(request.user_id, request.start_date, request.end_date, days, req.user.id);
      } else if (request.leave_type_used === 'compensatory') {
        // 调休：扣减调休余额 + 标记加班条目为已使用
        let bal = db.prepare(`SELECT * FROM leave_balances WHERE user_id=? AND leave_type='compensatory' AND year=?`).get(request.user_id, year);
        // 如果余额不足，尝试从全部加班单位重新计算额度
        if (!bal || (bal.entitled_days - bal.used_days) < days) {
          const allOvertime = db.prepare(
            `SELECT COUNT(*) as cnt FROM overtime_units WHERE user_id = ? AND strftime('%Y', work_date) = ?`
          ).get(request.user_id, String(year));
          // 计算全部加班单位对应的调休天数：3单位=1天，1-2单位=0.5天
          const overtimeDays = Math.floor(allOvertime.cnt / 3) + (allOvertime.cnt % 3 > 0 ? 0.5 : 0);
          if (overtimeDays >= days) {
            if (bal) {
              db.prepare('UPDATE leave_balances SET entitled_days = ? WHERE id = ?').run(overtimeDays, bal.id);
            } else {
              db.prepare(`INSERT INTO leave_balances (user_id, leave_type, year, entitled_days, used_days) VALUES (?, 'compensatory', ?, ?, 0)`).run(request.user_id, year, overtimeDays);
            }
            bal = db.prepare(`SELECT * FROM leave_balances WHERE user_id=? AND leave_type='compensatory' AND year=?`).get(request.user_id, year);
          } else {
            throw new Error('调休余额不足（加班单位不足以抵扣）');
          }
        }
        db.prepare('UPDATE leave_balances SET used_days = used_days + ? WHERE id = ?').run(days, bal.id);

        // 标记关联的加班条目，并记录请假日期
        // 计算需要标记的加班单位数：1天=3单位，0.5天=1单位
        const unitsNeeded = Math.floor(days) * 3 + (days % 1 >= 0.5 ? 1 : 0);
        const usedUnits = db.prepare(
          `SELECT id FROM overtime_units WHERE user_id = ? AND status = 'approved' ORDER BY work_date ASC LIMIT ?`
        ).all(request.user_id, unitsNeeded);

        // 生成请假日期数组
        const leaveDates = [];
        let currentDate = new Date(request.start_date);
        const endDate = new Date(request.end_date);
        while (currentDate <= endDate) {
          const dayOfWeek = currentDate.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 跳过周末
            leaveDates.push(currentDate.toISOString().slice(0, 10));
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }

        for (const u of usedUnits) {
          db.prepare(`UPDATE overtime_units SET status='used', leave_request_id=?, leave_type_mark='compensatory', leave_dates=? WHERE id=?`).run(request.id, JSON.stringify(leaveDates), u.id);
        }
        // 创建请假记录（用于请假明细展示）
        db.prepare(`INSERT INTO attendance_requests (user_id, type, leave_type_used, start_date, end_date, days, status, reason, manager_id, manager_comment, manager_time) VALUES (?, 'leave', 'compensatory', ?, ?, ?, 'entered', '考勤抵扣', ?, '管理员抵扣', datetime('now','localtime'))`).run(request.user_id, request.start_date, request.end_date, days, req.user.id);
      } else if (request.leave_type_used === 'mixed') {
        // 混合抵扣：年假 + 调休
        const annualDays = Number(request.annual_days) || 0;
        const compDays = days - annualDays

        // 扣减年假余额
        if (annualDays > 0) {
          const annualBal = db.prepare(`SELECT * FROM leave_balances WHERE user_id=? AND leave_type='annual' AND year=?`).get(request.user_id, year);
          if (!annualBal || (annualBal.entitled_days - annualBal.used_days) < annualDays) throw new Error('年假余额不足');
          db.prepare('UPDATE leave_balances SET used_days = used_days + ? WHERE id = ?').run(annualDays, annualBal.id);
        }

        // 扣减调休余额 + 标记加班条目
        if (compDays > 0) {
          let compBal = db.prepare(`SELECT * FROM leave_balances WHERE user_id=? AND leave_type='compensatory' AND year=?`).get(request.user_id, year);
          if (!compBal || (compBal.entitled_days - compBal.used_days) < compDays) {
            const allOvertime = db.prepare(`SELECT COUNT(*) as cnt FROM overtime_units WHERE user_id = ? AND strftime('%Y', work_date) = ?`).get(request.user_id, String(year));
            const overtimeDays = Math.floor(allOvertime.cnt / 3) + (allOvertime.cnt % 3 > 0 ? 0.5 : 0);
            if (overtimeDays >= compDays) {
              if (compBal) {
                db.prepare('UPDATE leave_balances SET entitled_days = ? WHERE id = ?').run(overtimeDays, compBal.id);
              } else {
                db.prepare(`INSERT INTO leave_balances (user_id, leave_type, year, entitled_days, used_days) VALUES (?, 'compensatory', ?, ?, 0)`).run(request.user_id, year, overtimeDays);
              }
              compBal = db.prepare(`SELECT * FROM leave_balances WHERE user_id=? AND leave_type='compensatory' AND year=?`).get(request.user_id, year);
            } else {
              throw new Error('调休余额不足');
            }
          }
          db.prepare('UPDATE leave_balances SET used_days = used_days + ? WHERE id = ?').run(compDays, compBal.id);

          // 标记加班条目
          const unitsNeeded = Math.floor(compDays) * 3 + (compDays % 1 >= 0.5 ? 1 : 0);
          const usedUnits = db.prepare(`SELECT id FROM overtime_units WHERE user_id = ? AND status = 'approved' ORDER BY work_date ASC LIMIT ?`).all(request.user_id, unitsNeeded);

          const leaveDates = [];
          let currentDate = new Date(request.start_date);
          const endDate = new Date(request.end_date);
          while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              leaveDates.push(currentDate.toISOString().slice(0, 10));
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }

          for (const u of usedUnits) {
            db.prepare(`UPDATE overtime_units SET status='used', leave_request_id=?, leave_type_mark='compensatory', leave_dates=? WHERE id=?`).run(request.id, JSON.stringify(leaveDates), u.id);
          }
        }

        // 创建请假记录（用于请假明细展示）
        if (annualDays > 0) {
          db.prepare(`INSERT INTO attendance_requests (user_id, type, leave_type_used, start_date, end_date, days, status, reason, manager_id, manager_comment, manager_time) VALUES (?, 'leave', 'annual', ?, ?, ?, 'entered', '混合抵扣-年假部分', ?, '管理员抵扣', datetime('now','localtime'))`).run(request.user_id, request.start_date, request.end_date, annualDays, req.user.id);
        }
        if (compDays > 0) {
          db.prepare(`INSERT INTO attendance_requests (user_id, type, leave_type_used, start_date, end_date, days, status, reason, manager_id, manager_comment, manager_time) VALUES (?, 'leave', 'compensatory', ?, ?, ?, 'entered', '混合抵扣-调休部分', ?, '管理员抵扣', datetime('now','localtime'))`).run(request.user_id, request.start_date, request.end_date, compDays, req.user.id);
        }
      }
      // business_trip 和 other 不扣余额
    } else if (request.type === 'special_leave') {
      const year = new Date(request.start_date).getFullYear();
      const days = Number(request.days) || 0;
      db.prepare(`
        INSERT INTO leave_balances (user_id, leave_type, year, entitled_days, used_days)
        VALUES (?,?,?,?,?)
        ON CONFLICT(user_id, leave_type, year) DO UPDATE SET
          entitled_days=excluded.entitled_days, used_days=used_days+excluded.used_days
      `).run(request.user_id, request.subtype || 'other', year, days, days);
    }

    db.prepare(
      `UPDATE attendance_requests SET status='entered', manager_id=?, manager_comment=?, manager_time=datetime('now','localtime') WHERE id=?`
    ).run(req.user.id, comment || null, request.id);
  });

  try {
    tx();
  } catch (err) {
    return res.status(400).json({ message: err.message || '录入失败' });
  }

  db.prepare('INSERT INTO audit_logs (user_id, action, detail) VALUES (?,?,?)').run(
    req.user.id, 'enter_request', `确认录入申请 ID=${req.params.id}`
  );
  res.json({ message: '已确认录入' });
});

module.exports = router;
