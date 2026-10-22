package com.attendance;

import com.attendance.util.BusinessRules;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * businessRules 纯逻辑单元测试（等价 Node 版 tests/businessRules.test.js）
 */
class BusinessRulesTest {

    @Test
    void hoursToUnits() {
        assertEquals(1, BusinessRules.hoursToUnits(3));
        assertEquals(1, BusinessRules.hoursToUnits(5));
        assertEquals(2, BusinessRules.hoursToUnits(6));
        assertEquals(0, BusinessRules.hoursToUnits(0));
        assertEquals(-1, BusinessRules.hoursToUnits(-3));
    }

    @Test
    void unitsToDays() {
        assertEquals(0.5, BusinessRules.unitsToDays(1));
        assertEquals(0.5, BusinessRules.unitsToDays(2));
        assertEquals(1.0, BusinessRules.unitsToDays(3));
        assertEquals(1.5, BusinessRules.unitsToDays(5));
        assertEquals(2.0, BusinessRules.unitsToDays(6));
        assertEquals(0.0, BusinessRules.unitsToDays(0));
    }

    @Test
    void daysToUnits() {
        assertEquals(3, BusinessRules.daysToUnits(1));
        assertEquals(1, BusinessRules.daysToUnits(0.5));
        assertEquals(4, BusinessRules.daysToUnits(1.5));
        assertEquals(6, BusinessRules.daysToUnits(2));
    }

    @Test
    void roundTrip() {
        assertEquals(2.0, BusinessRules.unitsToDays(BusinessRules.daysToUnits(2)));
        assertEquals(1.5, BusinessRules.unitsToDays(BusinessRules.daysToUnits(1.5)));
        assertEquals(0.5, BusinessRules.unitsToDays(BusinessRules.daysToUnits(0.5)));
    }

    @Test
    void annualLeaveDays() {
        assertEquals(0, BusinessRules.annualLeaveDays("2024-01-01", 2024, "2024-06-01"));
        assertEquals(5, BusinessRules.annualLeaveDays("2020-01-01", 2024, "2020-01-01"));
        assertEquals(10, BusinessRules.annualLeaveDays("2010-01-01", 2024, "2010-01-01"));
        assertEquals(15, BusinessRules.annualLeaveDays("2000-01-01", 2024, "2000-01-01"));
        // 优先用 company_hire_date
        assertEquals(5, BusinessRules.annualLeaveDays("2010-01-01", 2024, "2022-01-01"));
        // 无 company_hire_date 回退 hire_date
        assertEquals(5, BusinessRules.annualLeaveDays("2020-01-01", 2024, null));
    }

    @Test
    void canUseAnnualLeave() {
        assertTrue(BusinessRules.canUseAnnualLeave("2023-01-01", 2024));
        assertFalse(BusinessRules.canUseAnnualLeave("2024-06-01", 2024));
    }

    @Test
    void companyTenureYears() {
        assertEquals(999, BusinessRules.companyTenureYears(null, 2024));
        assertEquals(4, BusinessRules.companyTenureYears("2020-01-01", 2024));
    }

    @Test
    void calcEffectiveHours() {
        assertEquals(8.67, BusinessRules.calcEffectiveHours("08:20", "17:00"));
        assertEquals(8.67, BusinessRules.calcEffectiveHours("07:30", "17:00"));
        assertEquals(0, BusinessRules.calcEffectiveHours(null, "17:00"));
        assertEquals(0, BusinessRules.calcEffectiveHours("08:20", null));
        assertEquals(7.67, BusinessRules.calcEffectiveHours("08:20", "16:00"));
    }

    @Test
    void isShortage() {
        assertFalse(BusinessRules.isShortage(BusinessRules.STANDARD_WORK_HOURS));
        assertTrue(BusinessRules.isShortage(8.66));
        assertTrue(BusinessRules.isShortage(0));
        assertEquals(8.67, BusinessRules.STANDARD_WORK_HOURS);
    }
}
