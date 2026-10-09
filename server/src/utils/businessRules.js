/**
 * 业务规则工具函数
 * 加班工时/假期抵扣/年假分档 核心计算逻辑
 */

// 标准工作日时长（08:20 上班，17:00 下班 = 8小时40分钟 = 8.67小时）
const STANDARD_WORK_HOURS = 8.67;

// 加班小时 → 加班单位（每 3 小时 = 1 单位，向下取整）
function hoursToUnits(hours) {
  return Math.floor(Number(hours) / 3);
}

// 加班单位 → 可抵扣天数
// 规则：3单位=1天，1-2单位=0.5天
// 1单位=0.5天，2单位=0.5天，3单位=1天，4-5单位=1.5天，6单位=2天
function unitsToDays(units) {
  const u = Number(units);
  return Math.floor(u / 3) + (u % 3 > 0 ? 0.5 : 0);
}

// 所需天数 → 需消耗的加班单位
// 规则：3 个加班单位 = 整天，1 个加班单位 = 半天
// 整天优先用 3 单位，半天用 1 单位
function daysToUnits(days) {
  const d = Number(days);
  const fullDays = Math.floor(d);
  const hasHalf = (d - fullDays) >= 0.5;
  return fullDays * 3 + (hasHalf ? 1 : 0);
}

// 年假分档（按入职日期到目标年份的工龄）
function annualLeaveDays(hireDate, targetYear) {
  const hire = new Date(hireDate);
  const years = targetYear - hire.getFullYear();
  if (years < 1) return 0;
  if (years < 10) return 5;
  if (years < 20) return 10;
  return 15;
}

// 考勤是否达标（有效工时 < 8.67 小时为短缺，与标准工作日一致）
function isShortage(effectiveHours) {
  return Number(effectiveHours) < STANDARD_WORK_HOURS;
}

// 根据打卡时间计算有效工时（08:20 上班，17:00 下班）
function calcEffectiveHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const [inH, inM] = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);
  const inMinutes = inH * 60 + inM;
  const outMinutes = outH * 60 + outM;
  // 标准上班时间 08:20 = 500 分钟
  const standardStart = 8 * 60 + 20;
  // 最早从标准时间开始计算
  const effectiveIn = Math.max(inMinutes, standardStart);
  const diff = outMinutes - effectiveIn;
  if (diff <= 0) return 0;
  return Math.round((diff / 60) * 100) / 100;
}

module.exports = {
  STANDARD_WORK_HOURS,
  hoursToUnits,
  unitsToDays,
  daysToUnits,
  annualLeaveDays,
  isShortage,
  calcEffectiveHours
};
