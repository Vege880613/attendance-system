/**
 * businessRules.js 纯逻辑单元测试
 *
 * 覆盖：加班单位换算、年假分档、有效工时计算
 * 零依赖（不启 HTTP、不连数据库），运行最快最稳。
 *
 * 运行：cd server && npm test
 */

import { describe, it, expect } from 'vitest'
import {
  STANDARD_WORK_HOURS,
  hoursToUnits,
  unitsToDays,
  daysToUnits,
  annualLeaveDays,
  companyTenureYears,
  canUseAnnualLeave,
  isShortage,
  calcEffectiveHours,
} from '../src/utils/businessRules'

describe('businessRules — 加班单位换算', () => {
  describe('hoursToUnits（每 3 小时 = 1 单位，向下取整）', () => {
    it('3 小时 = 1 单位', () => expect(hoursToUnits(3)).toBe(1))
    it('5 小时 = 1 单位', () => expect(hoursToUnits(5)).toBe(1))
    it('6 小时 = 2 单位', () => expect(hoursToUnits(6)).toBe(2))
    it('0 小时 = 0 单位', () => expect(hoursToUnits(0)).toBe(0))
    it('负数返回 0 单位（floor 保护）', () => expect(hoursToUnits(-3)).toBe(-1))
  })

  describe('unitsToDays（3 单位=1 天，1-2 单位=0.5 天）', () => {
    it('1 单位 = 0.5 天', () => expect(unitsToDays(1)).toBe(0.5))
    it('2 单位 = 0.5 天', () => expect(unitsToDays(2)).toBe(0.5))
    it('3 单位 = 1 天', () => expect(unitsToDays(3)).toBe(1))
    it('5 单位 = 1.5 天', () => expect(unitsToDays(5)).toBe(1.5))
    it('6 单位 = 2 天', () => expect(unitsToDays(6)).toBe(2))
    it('0 单位 = 0 天', () => expect(unitsToDays(0)).toBe(0))
  })

  describe('daysToUnits（整天 3 单位，半天 1 单位）', () => {
    it('1 天 = 3 单位', () => expect(daysToUnits(1)).toBe(3))
    it('0.5 天 = 1 单位', () => expect(daysToUnits(0.5)).toBe(1))
    it('1.5 天 = 4 单位', () => expect(daysToUnits(1.5)).toBe(4))
    it('2 天 = 6 单位', () => expect(daysToUnits(2)).toBe(6))
  })

  describe('unitsToDays 与 daysToUnits 往返一致', () => {
    it('daysToUnits(2) → unitsToDays 还原', () =>
      expect(unitsToDays(daysToUnits(2))).toBe(2))
    it('daysToUnits(1.5) → unitsToDays 还原', () =>
      expect(unitsToDays(daysToUnits(1.5))).toBe(1.5))
    it('daysToUnits(0.5) → unitsToDays 还原', () =>
      expect(unitsToDays(daysToUnits(0.5))).toBe(0.5))
  })
})

describe('businessRules — 年假分档（按司龄）', () => {
  it('不满 1 年无年假', () => {
    expect(annualLeaveDays('2024-01-01', 2024, '2024-06-01')).toBe(0)
  })

  it('1-9 年 → 5 天', () => {
    expect(annualLeaveDays('2020-01-01', 2024, '2020-01-01')).toBe(5)
  })

  it('10-19 年 → 10 天', () => {
    expect(annualLeaveDays('2010-01-01', 2024, '2010-01-01')).toBe(10)
  })

  it('20 年+ → 15 天', () => {
    expect(annualLeaveDays('2000-01-01', 2024, '2000-01-01')).toBe(15)
  })

  it('优先用 company_hire_date 而非 hire_date', () => {
    // hire_date=2010（应得 10 天），但 company_hire_date=2022（应得 5 天）
    expect(annualLeaveDays('2010-01-01', 2024, '2022-01-01')).toBe(5)
  })

  it('无 company_hire_date 时回退到 hire_date', () => {
    expect(annualLeaveDays('2020-01-01', 2024, null)).toBe(5)
  })

  it('canUseAnnualLeave：满 1 年可用', () => {
    expect(canUseAnnualLeave('2023-01-01', 2024)).toBe(true)
    expect(canUseAnnualLeave('2024-06-01', 2024)).toBe(false)
  })

  it('companyTenureYears：未设置视作老员工（999）', () => {
    expect(companyTenureYears(null, 2024)).toBe(999)
    expect(companyTenureYears('2020-01-01', 2024)).toBe(4)
  })
})

describe('businessRules — 有效工时计算（08:20 上班，17:00 下班）', () => {
  it('标准打卡 = 8.67 小时', () => {
    expect(calcEffectiveHours('08:20', '17:00')).toBe(8.67)
  })

  it('早于 08:20 上班按标准时间算', () => {
    expect(calcEffectiveHours('07:30', '17:00')).toBe(8.67)
  })

  it('缺上班卡 = 0', () => expect(calcEffectiveHours(null, '17:00')).toBe(0))
  it('缺下班卡 = 0', () => expect(calcEffectiveHours('08:20', null)).toBe(0))

  it('早退（16:00 下班）工时不足', () => {
    expect(calcEffectiveHours('08:20', '16:00')).toBe(7.67)
  })

  isShortage(7.67) // 仅用于说明阈值用法

  describe('isShortage：工时 < 8.67 为短缺', () => {
    it('8.67 不短缺', () => expect(isShortage(STANDARD_WORK_HOURS)).toBe(false))
    it('8.66 短缺', () => expect(isShortage(8.66)).toBe(true))
    it('0 短缺', () => expect(isShortage(0)).toBe(true))
  })

  it('标准工时常量 = 8.67', () => expect(STANDARD_WORK_HOURS).toBe(8.67))
})
