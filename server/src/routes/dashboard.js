const db = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { STANDARD_WORK_HOURS } = require('../utils/businessRules');

const router = require('express').Router();

// 月度汇总 - 所有员工的考勤+请假合并视图
router.get('/summary', authRequired, requireRole('manager', 'team_lead'), (req, res) => {
  const { yearMonth } = req.query;
  if (!yearMonth) return res.status(400).json({ message: '请指定年月' });

  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // 获取所有活跃员工
  let userFilter = '';
  const params = [];
  if (req.user.role === 'team_lead') {
    userFilter = ' AND u.team_id = ?';
    const me = db.prepare('SELECT team_id FROM users WHERE id = ?').get(req.user.id);
    params.push(me.team_id);
  }

  const users = db.prepare(`
    SELECT u.id, u.name, u.team_id, t.name AS team_name
    FROM users u LEFT JOIN teams t ON u.team_id = t.id
    WHERE u.status = 'active' AND u.role != 'manager' ${userFilter}
    ORDER BY u.team_id, u.id
  `).all(...params);

  // 获取该月所有考勤记录
  const attendanceRecords = db.prepare(`
    SELECT * FROM attendance_records
    WHERE strftime('%Y-%m', work_date) = ?
  `).all(yearMonth);

  // 获取该月所有节假日
  const holidays = db.prepare(`
    SELECT * FROM holidays
    WHERE strftime('%Y-%m', date) = ?
  `).all(yearMonth);

  // 获取该月所有已录入的请假申请（只查请假，不含加班）
  const leaveRequests = db.prepare(`
    SELECT * FROM attendance_requests
    WHERE status = 'entered'
      AND type = 'leave'
      AND strftime('%Y-%m', start_date) <= ?
      AND strftime('%Y-%m', end_date) >= ?
  `).all(yearMonth, yearMonth);

  // 获取加班单位汇总
  const overtimeSummary = db.prepare(`
    SELECT user_id,
           COUNT(*) AS total_units,
           SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS available_units
    FROM overtime_units
    WHERE strftime('%Y-%m', work_date) = ? AND status IN ('approved', 'pending')
    GROUP BY user_id
  `).all(yearMonth);

  // 获取假期余额
  const leaveBalances = db.prepare(`
    SELECT * FROM leave_balances WHERE year = ?
  `).all(year);

  // 构建每个员工的汇总
  const summaryList = users.map(user => {
    const userAttendance = attendanceRecords.filter(a => a.user_id === user.id);
    const userLeaves = leaveRequests.filter(l => l.user_id === user.id);
    const userOvertime = overtimeSummary.find(o => o.user_id === user.id);
    const userBalances = leaveBalances.filter(b => b.user_id === user.id);

    // 构建每日明细
    const dailyDetails = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(dateStr).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // 查找该日的考勤记录
      const attendance = userAttendance.find(a => a.work_date === dateStr);

      // 查找该日是否在请假范围内
      const leave = userLeaves.find(l => dateStr >= l.start_date && dateStr <= l.end_date);

      // 查找该日是否为节假日
      const holiday = holidays.find(h => h.date === dateStr);

      if (holiday && holiday.type === "holiday") {
        // 法定假日
        dailyDetails.push({
          date: dateStr,
          dayOfWeek,
          type: "holiday",
          status: holiday.name || "节假日"
        });
      } else if (isWeekend && !holiday) {
        dailyDetails.push({
          date: dateStr,
          dayOfWeek,
          type: 'weekend',
          status: '休息'
        });
      } else if (leave) {
        // 请假
        const leaveTypeMap = {
          annual: '年假',
          compensatory: '调休',
          mixed: '混合抵扣（年假+调休）',
          business_trip: '公差',
          other: '其他'
        };
        dailyDetails.push({
          date: dateStr,
          dayOfWeek,
          type: 'leave',
          status: '请假',
          leaveType: leave.leave_type_used,
          leaveTypeName: leaveTypeMap[leave.leave_type_used] || leave.leave_type_used,
          leaveDays: leave.days,
          leaveReason: leave.reason,
          effectiveHours: 0,
          isShortage: false
        });
      } else if (attendance) {
        // 有考勤记录
        // 判断状态：
        // 1. 已有抵扣（offset_type != 'none'）→ 已抵扣
        // 2. >= STANDARD_WORK_HOURS → 正常
        // 3. > 0 且 < STANDARD_WORK_HOURS → 缺卡
        // 4. <= 0 → 旷工
        const effectiveHours = attendance.effective_hours;
        let status, isShortage;

        if (attendance.offset_type && attendance.offset_type !== 'none') {
          // 已用假期/调休抵扣，不再算缺卡或旷工
          const offsetLabelMap = {
            annual_leave: '年假抵扣',
            compensatory_leave: '调休抵扣'
          };
          status = offsetLabelMap[attendance.offset_type] || '已抵扣';
          isShortage = false;
        } else if (effectiveHours >= STANDARD_WORK_HOURS) {
          status = '正常';
          isShortage = false;
        } else if (effectiveHours > 0) {
          status = '缺卡';
          isShortage = true;
        } else {
          status = '旷工';
          isShortage = true;
        }

        const offsetLabelMap = {
          annual_leave: '年假抵扣',
          compensatory_leave: '调休抵扣'
        };
        dailyDetails.push({
          date: dateStr,
          dayOfWeek,
          type: 'attendance',
          status,
          checkIn: attendance.check_in,
          checkOut: attendance.check_out,
          effectiveHours,
          isShortage,
          offsetType: attendance.offset_type,
          offsetUnits: attendance.offset_units,
          offsetLabel: offsetLabelMap[attendance.offset_type] || '',
          remark: attendance.remark
        });
      } else {
        // 无考勤记录 = 旷工（可抵扣）
        dailyDetails.push({
          date: dateStr,
          dayOfWeek,
          type: 'attendance',
          status: '旷工',
          checkIn: '',
          checkOut: '',
          effectiveHours: 0,
          isShortage: true,
          offsetType: 'none',
          offsetUnits: 0,
          offsetLabel: '',
          remark: ''
        });
      }
    }

    // 统计汇总
    const workDays = dailyDetails.filter(d => d.type !== 'weekend').length;
    const normalDays = dailyDetails.filter(d => d.status === '正常').length;
    const absentDays = dailyDetails.filter(d => d.status === '旷工').length;
    const shortageDays = dailyDetails.filter(d => d.isShortage && d.type !== 'weekend' && d.status !== '旷工').length;
    const leaveDays = dailyDetails.filter(d => d.type === 'leave').length;

    // 假期余额
    const annualBalance = userBalances.find(b => b.leave_type === 'annual');
    const compBalance = userBalances.find(b => b.leave_type === 'compensatory');

    return {
      userId: user.id,
      userName: user.name,
      teamName: user.team_name,
      summary: {
        totalDays: daysInMonth,
        workDays,
        normalDays,
        shortageDays,
        leaveDays,
        absentDays,
        overtimeUnits: userOvertime ? userOvertime.available_units || 0 : 0,
        annualLeaveRemaining: annualBalance ? (annualBalance.entitled_days - annualBalance.used_days).toFixed(1) : 0,
        compLeaveRemaining: compBalance ? (compBalance.entitled_days - compBalance.used_days).toFixed(1) : 0
      },
      dailyDetails
    };
  });

  res.json({
    yearMonth,
    daysInMonth,
    totalEmployees: users.length,
    list: summaryList
  });
});

module.exports = router;
