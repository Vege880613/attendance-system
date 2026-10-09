/**
 * 测试数据初始化脚本
 * 创建班组、班组长、员工、年假、考勤数据
 * 运行方式：node src/utils/seedData.js
 */
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const hash = bcrypt.hashSync('123456', 10);
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const seed = db.transaction(() => {
  // 清空旧数据（保留 admin）
  db.exec(`
    DELETE FROM attendance_records;
    DELETE FROM overtime_units;
    DELETE FROM leave_balances;
    DELETE FROM attendance_requests;
    DELETE FROM audit_logs;
    DELETE FROM users WHERE id > 1;
    DELETE FROM teams;
  `);

  // 创建班组
  const teams = [
    { name: '生产车间A', lead_username: 'lisi' },
    { name: '生产车间B', lead_username: 'wangwu' },
    { name: '质检部', lead_username: 'zhaoliu' }
  ];

  const createTeam = db.prepare('INSERT INTO teams (name) VALUES (?)');
  const updateTeamLead = db.prepare('UPDATE teams SET lead_user_id = ? WHERE id = ?');
  const createUser = db.prepare(
    `INSERT INTO users (username, password_hash, name, role, team_id, hire_date, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`
  );

  let teamIds = {};
  let userIds = {};

  // 先创建班组
  teams.forEach(t => {
    const info = createTeam.run(t.name);
    teamIds[t.name] = info.lastInsertRowid;
  });

  // 创建班组长
  const leads = [
    { username: 'lisi', name: '李四', team: '生产车间A', hire: '2015-03-01' },
    { username: 'wangwu', name: '王五', team: '生产车间B', hire: '2012-07-15' },
    { username: 'zhaoliu', name: '赵六', team: '质检部', hire: '2018-01-10' }
  ];
  leads.forEach(l => {
    const info = createUser.run(l.username, hash, l.name, 'team_lead', teamIds[l.team], l.hire);
    userIds[l.username] = info.lastInsertRowid;
    updateTeamLead.run(info.lastInsertRowid, teamIds[l.team]);
  });

  // 创建员工
  const employees = [
    { username: 'zhangsan', name: '张三', team: '生产车间A', hire: '2020-06-01' },
    { username: 'zhangsi', name: '张四', team: '生产车间A', hire: '2022-02-15' },
    { username: 'sunqi', name: '孙七', team: '生产车间B', hire: '2019-08-20' },
    { username: 'sunba', name: '孙八', team: '生产车间B', hire: '2023-01-05' },
    { username: 'zhoujiu', name: '周九', team: '质检部', hire: '2021-04-12' },
    { username: 'wushi', name: '吴十', team: '质检部', hire: '2017-11-30' }
  ];
  employees.forEach(e => {
    const info = createUser.run(e.username, hash, e.name, 'employee', teamIds[e.team], e.hire);
    userIds[e.username] = info.lastInsertRowid;
  });

  // 初始化 2026 年年假
  const initLeave = db.prepare(
    `INSERT INTO leave_balances (user_id, leave_type, year, entitled_days, used_days)
     VALUES (?, 'annual', 2026, ?, 0)
     ON CONFLICT(user_id, leave_type, year) DO UPDATE SET entitled_days=excluded.entitled_days`
  );

  const annualLeaveDays = (hireDate, year) => {
    const years = year - new Date(hireDate).getFullYear();
    if (years < 1) return 0;
    if (years < 10) return 5;
    if (years < 20) return 10;
    return 15;
  };

  const allUsers = [...leads, ...employees];
  allUsers.forEach(u => {
    const days = annualLeaveDays(u.hire, 2026);
    initLeave.run(userIds[u.username], days);
  });

  // 为张三录入 2026-10 月考勤（含 2 天短缺）
  const userId = userIds['zhangsan'];
  const insertAttendance = db.prepare(`
    INSERT INTO attendance_records (user_id, work_date, check_in, check_out, effective_hours, is_shortage, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const daysInMonth = 31;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `2026-10-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(date).getDay();
    // 周末跳过
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    let checkIn = '08:20';
    let checkOut = '17:00';
    let effective = 8;
    let shortage = 0;
    let remark = '';

    // 模拟几天异常
    if (d === 5) { checkIn = '09:00'; effective = 7.33; shortage = 1; remark = '迟到'; }
    if (d === 12) { checkOut = '16:00'; effective = 7.33; shortage = 1; remark = '早退'; }
    if (d === 20) { checkIn = '09:30'; effective = 6.83; shortage = 1; remark = '迟到'; }

    // 计算有效工时
    if (shortage) {
      const [inH, inM] = checkIn.split(':').map(Number);
      const [outH, outM] = checkOut.split(':').map(Number);
      const standardStart = 8 * 60 + 20;
      const effectiveIn = Math.max(inH * 60 + inM, standardStart);
      const diff = (outH * 60 + outM) - effectiveIn;
      effective = diff > 0 ? Math.round((diff / 60) * 100) / 100 : 0;
    }

    insertAttendance.run(userId, date, checkIn, checkOut, effective, shortage, remark);
  }

  // 为张三添加一些已审核的加班单位
  const insertOvertime = db.prepare(
    `INSERT INTO overtime_units (user_id, work_date, hours, units_count, status) VALUES (?, ?, 3, 1, 'approved')`
  );
  insertOvertime.run(userId, '2026-10-03');
  insertOvertime.run(userId, '2026-10-10');
  insertOvertime.run(userId, '2026-10-17');

  // 创建一条已录入的婚丧嫁娶假（周九的婚假）
  const zhoujiuId = userIds['zhoujiu'];
  db.prepare(`
    INSERT INTO leave_balances (user_id, leave_type, year, entitled_days, used_days)
    VALUES (?, 'marriage', 2026, 3, 1.5)
    ON CONFLICT(user_id, leave_type, year) DO UPDATE SET entitled_days=3, used_days=1.5
  `).run(zhoujiuId);

  console.log('✅ 测试数据创建完成！');
  console.log('');
  console.log('=== 班组 ===');
  Object.entries(teamIds).forEach(([name, id]) => console.log(`  ${id}: ${name}`));
  console.log('');
  console.log('=== 班组长 ===');
  leads.forEach(l => console.log(`  ${l.username} / 123456 → ${l.name} (${l.team})`));
  console.log('');
  console.log('=== 员工 ===');
  employees.forEach(e => console.log(`  ${e.username} / 123456 → ${e.name} (${e.team})`));
  console.log('');
  console.log('=== 年假（2026）===');
  allUsers.forEach(u => {
    const days = annualLeaveDays(u.hire, 2026);
    console.log(`  ${u.name}: ${days} 天`);
  });
  console.log('');
  console.log('=== 张三(zhangsan) 2026-10 考勤 ===');
  console.log('  已录入 10 月工作日考勤（含 3 天短缺标红）');
  console.log('  已添加 3 个可用加班单位');
  console.log('');
  console.log('=== 周九(zhoujiu) 婚假 ===');
  console.log('  已使用 1.5 天婚假');
});

seed();

process.exit(0);
