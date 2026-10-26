package com.attendance.util;

/**
 * 业务规则工具函数（无损复刻 server/src/utils/businessRules.js）
 * 加班工时/假期抵扣/年假分档 核心计算逻辑
 */
public class BusinessRules {

    /** 标准工作日时长（08:20 上班，17:00 下班 = 8小时40分钟 = 8.67小时） */
    public static final double STANDARD_WORK_HOURS = 8.67;

    /** 标准上班时间（分钟）：08:20 */
    private static final int STANDARD_WORK_MINUTES = 8 * 60 + 20;

    /** 标准下班时间（分钟）：17:00 */
    private static final int STANDARD_END = 17 * 60;

    /** 加班小时 → 加班单位（每 3 小时 = 1 单位，向下取整） */
    public static int hoursToUnits(double hours) {
        return (int) Math.floor(hours / 3);
    }

    /** 加班单位 → 可抵扣天数：3单位=1天，1-2单位=0.5天 */
    public static double unitsToDays(double units) {
        return Math.floor(units / 3) + (units % 3 > 0 ? 0.5 : 0);
    }

    /** 所需天数 → 需消耗的加班单位：整天优先用 3 单位，半天用 1 单位 */
    public static int daysToUnits(double days) {
        int fullDays = (int) Math.floor(days);
        boolean hasHalf = (days - fullDays) >= 0.5;
        return fullDays * 3 + (hasHalf ? 1 : 0);
    }

    /** 年假分档（按入职本司时间优先，其次入职日期）到目标年份的工龄 */
    public static double annualLeaveDays(String hireDate, int targetYear, String companyHireDate) {
        String calcDate = (companyHireDate != null && !companyHireDate.isEmpty()) ? companyHireDate : hireDate;
        if (calcDate == null || calcDate.isEmpty()) return 0;
        int hireYear = Integer.parseInt(calcDate.substring(0, 4));
        int years = targetYear - hireYear;
        if (years < 1) return 0;
        if (years < 10) return 5;
        if (years < 20) return 10;
        return 15;
    }

    /** 计算入职本司时长（年），未设置则视为老员工 */
    public static int companyTenureYears(String companyHireDate, int targetYear) {
        if (companyHireDate == null || companyHireDate.isEmpty()) return 999;
        int hireYear = Integer.parseInt(companyHireDate.substring(0, 4));
        return targetYear - hireYear;
    }

    /** 是否可以使用年假（入职满 1 年） */
    public static boolean canUseAnnualLeave(String companyHireDate, int targetYear) {
        return companyTenureYears(companyHireDate, targetYear) >= 1;
    }

    /** 考勤是否达标（有效工时 < 8.67 小时为短缺） */
    public static boolean isShortage(double effectiveHours) {
        return effectiveHours < STANDARD_WORK_HOURS;
    }

    /** 解析 HH:mm 为分钟数；空值返回 -1 */
    private static int toMinutes(String hhmm) {
        if (hhmm == null || hhmm.isEmpty()) return -1;
        String[] p = hhmm.split(":");
        return Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
    }

    /** 迟到分钟数：check_in 晚于 08:20 的部分（无迟到返回 0） */
    public static double lateMinutes(String checkIn) {
        int m = toMinutes(checkIn);
        if (m < 0) return 0;
        return Math.max(0, m - STANDARD_WORK_MINUTES);
    }

    /** 早退分钟数：check_out 早于 17:00 的部分（无早退返回 0） */
    public static double earlyMinutes(String checkOut) {
        int m = toMinutes(checkOut);
        if (m < 0) return 0;
        return Math.max(0, STANDARD_END - m);
    }

    /** 根据打卡时间计算有效工时（08:20 上班基准），保留 2 位小数 */
    public static double calcEffectiveHours(String checkIn, String checkOut) {
        if (checkIn == null || checkOut == null || checkIn.isEmpty() || checkOut.isEmpty()) return 0;
        int inMinutes = toMinutes(checkIn);
        int outMinutes = toMinutes(checkOut);
        if (inMinutes < 0 || outMinutes < 0) return 0;
        int effectiveIn = Math.max(inMinutes, STANDARD_WORK_MINUTES);
        int diff = outMinutes - effectiveIn;
        if (diff <= 0) return 0;
        return Math.round((diff / 60.0) * 100) / 100.0;
    }
}
