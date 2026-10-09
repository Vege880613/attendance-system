const express = require('express');
const XLSX = require('xlsx');
const db = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { calcEffectiveHours, isShortage } = require('../utils/businessRules');

const router = express.Router();

// Excel 批量导入考勤
router.post('/import', authRequired, requireRole('manager'), (req, res) => {
  const { data } = req.body; // data: [{user_id, date, check_in, check_out}]
  if (!Array.isArray(data)) {
    return res.status(400).json({ message: '参数不合法' });
  }

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
      insert.run(
        r.user_id,
        r.date,
        r.check_in || null,
        r.check_out || null,
        effective,
        shortage,
        r.remark || null
      );
    }
  });

  try {
    tx(data);
    db.prepare('INSERT INTO audit_logs (user_id, action, detail) VALUES (?,?,?)').run(
      req.user.id, 'import_attendance', `Excel导入考勤 ${data.length} 条`
    );
    res.json({ message: `成功导入 ${data.length} 条考勤记录` });
  } catch (err) {
    res.status(500).json({ message: '导入失败: ' + err.message });
  }
});

// 解析 Excel 文件并返回预览数据（支持工号+姓名格式，每员工2行）
router.post('/parse-excel', authRequired, requireRole('manager'), (req, res) => {
  const { fileBase64, year } = req.body;
  if (!fileBase64) return res.status(400).json({ message: '请上传文件' });

  try {
    const buffer = Buffer.from(fileBase64, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });

    const targetYear = year || new Date().getFullYear();

    // 获取用户列表用于匹配（支持工号、姓名、用户名）
    const users = db.prepare('SELECT id, name, employee_id, username FROM users WHERE status = ?').all('active');
    const userByEmployeeId = {};
    const userByName = {};
    users.forEach(u => {
      if (u.employee_id) userByEmployeeId[String(u.employee_id).trim()] = u;
      userByName[u.name.trim().toLowerCase()] = u;
      userByName[u.username.trim().toLowerCase()] = u;
    });

    const parsed = [];
    const errors = [];

    // 找到表头行和数据起始行
    let headerRowIdx = -1;
    let dateRowIdx = -1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] === '工号' && row[1] === '姓名') {
        headerRowIdx = i;
        dateRowIdx = i + 1;
        break;
      }
    }

    if (headerRowIdx === -1) {
      return res.status(400).json({ message: '无法找到表头行，请确认文件格式正确' });
    }

    // 解析日期行
    const dateRow = rows[dateRowIdx];
    const dateMap = {}; // {列索引: 日期}
    for (let col = 4; col <= 34; col++) {
      const dateStr = String(dateRow[col] || '').trim();
      if (dateStr && /^\d{2}\/\d{2}$/.test(dateStr)) {
        const [month, day] = dateStr.split('/');
        dateMap[col] = `${targetYear}-${month}-${day}`;
      }
    }

    // 解析员工数据（从表头后2行开始）
    let currentEmployee = null;

    for (let i = dateRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const col0 = String(row[0] || '').trim();
      const col3 = String(row[3] || '').trim();

      if (!col0 && !col3) continue; // 跳过空行

      if (col3 === '上班') {
        // 新员工的上班行
        const employeeId = col0;
        const name = String(row[1] || '').trim();

        const user = userByEmployeeId[employeeId] || userByName[name.toLowerCase()];
        if (!user) {
          errors.push(`第${i + 1}行: 找不到员工"${name}"(工号:${employeeId})`);
          currentEmployee = null;
          continue;
        }

        currentEmployee = {
          user_id: user.id,
          user_name: user.name,
          employee_id: user.employee_id,
          checkIns: {},
          checkOuts: {}
        };

        // 解析上班时间
        for (const [col, date] of Object.entries(dateMap)) {
          const timeVal = String(row[col] || '').trim();
          if (timeVal && timeVal !== '休息' && timeVal !== '漏卡' && /^\d{2}:\d{2}$/.test(timeVal)) {
            currentEmployee.checkIns[date] = timeVal;
          }
        }
      } else if (col3 === '下班' && currentEmployee) {
        // 下班行
        for (const [col, date] of Object.entries(dateMap)) {
          const timeVal = String(row[col] || '').trim();
          if (timeVal && timeVal !== '休息' && timeVal !== '漏卡' && /^\d{2}:\d{2}$/.test(timeVal)) {
            currentEmployee.checkOuts[date] = timeVal;
          }
        }

        // 合并该员工的数据
        for (const date of Object.keys(dateMap)) {
          const checkIn = currentEmployee.checkIns[date] || '';
          const checkOut = currentEmployee.checkOuts[date] || '';

          if (checkIn || checkOut) {
            parsed.push({
              user_id: currentEmployee.user_id,
              user_name: currentEmployee.user_name,
              date,
              check_in: checkIn,
              check_out: checkOut
            });
          }
        }

        currentEmployee = null;
      }
    }

    res.json({ parsed, errors, total: parsed.length });
  } catch (err) {
    res.status(500).json({ message: '解析Excel失败: ' + err.message });
  }
});

// 下载 Excel 模板（工号+姓名格式，与实际考勤表一致）
router.get('/template', authRequired, requireRole('manager'), (req, res) => {
  const daysInMonth = 31;
  const headerRow = ['工号', '姓名', '部门', '上班/下班'];
  const dateRow = ['', '', '', ''];

  for (let d = 1; d <= daysInMonth; d++) {
    headerRow.push(`08/${String(d).padStart(2, '0')}`);
    dateRow.push(`08/${String(d).padStart(2, '0')}`);
  }

  // 示例数据
  const sampleCheckIn = ['01000001', '张三', 'IT开发中心', '上班', '08:20', '08:18', '休息', '08:17', '08:19', '休息', '休息', '08:16', '08:15', '08:17', '08:18', '08:20', '休息', '休息', '08:14', '08:16', '08:18', '08:19', '08:17', '休息', '休息', '08:15', '08:18', '08:16', '08:17', '08:19', '休息', '休息', '08:16', '08:18', '08:17', '08:19'];
  const sampleCheckOut = ['', '', '', '下班', '17:01', '17:03', '休息', '17:04', '17:00', '休息', '休息', '17:05', '17:02', '17:01', '17:03', '17:00', '休息', '休息', '17:04', '17:02', '17:01', '17:03', '17:00', '休息', '休息', '17:05', '17:02', '17:04', '17:01', '17:03', '休息', '休息', '17:02', '17:01', '17:04', '17:00'];

  const ws = XLSX.utils.aoa_to_sheet([headerRow, dateRow, sampleCheckIn, sampleCheckOut]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '考勤数据');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=attendance_template.xlsx');
  res.send(buffer);
});

module.exports = router;
