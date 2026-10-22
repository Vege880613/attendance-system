package com.attendance;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 仪表盘接口（等价 Node 版 tests/dashboard.test.js）
 */
class DashboardTest extends BaseTest {

    @BeforeEach
    void setUpData() {
        support.seed();
        support.db().update("INSERT INTO attendance_records (user_id, work_date, check_in, check_out, effective_hours) VALUES (3, '2026-10-01', '08:20', '17:00', 8.67)");
    }

    @Test
    @SuppressWarnings("unchecked")
    void adminSummary() {
        ResponseEntity<Map> res = get("/api/dashboard/summary?yearMonth=2026-10", support.adminToken());
        assertEquals(200, res.getStatusCodeValue());
        assertEquals("2026-10", res.getBody().get("yearMonth"));
        List<Map> list = (List<Map>) res.getBody().get("list");
        assertTrue(list.stream().anyMatch(s -> "爱丽丝".equals(s.get("userName"))));
    }

    @Test
    @SuppressWarnings("unchecked")
    void summaryHasDetailsAndStats() {
        ResponseEntity<Map> res = get("/api/dashboard/summary?yearMonth=2026-10", support.adminToken());
        List<Map> list = (List<Map>) res.getBody().get("list");
        Map alice = list.stream().filter(s -> "爱丽丝".equals(s.get("userName"))).findFirst().orElse(null);
        assertNotNull(alice);
        Map summary = (Map) alice.get("summary");
        assertNotNull(summary.get("workDays"));
        assertNotNull(summary.get("annualLeaveRemaining"));
        assertTrue(alice.get("dailyDetails") instanceof List);
    }

    @Test
    @SuppressWarnings("unchecked")
    void leadSeesOwnTeamOnly() {
        ResponseEntity<Map> res = get("/api/dashboard/summary?yearMonth=2026-10", support.teamLeadToken());
        assertEquals(200, res.getStatusCodeValue());
        List<Map> list = (List<Map>) res.getBody().get("list");
        assertTrue(list.stream().allMatch(s -> "测试一组".equals(s.get("teamName"))));
    }

    @Test
    void missingYearMonth400() {
        ResponseEntity<Map> res = get("/api/dashboard/summary", support.adminToken());
        assertEquals(400, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("请指定年月"));
    }

    @Test
    void employeeForbidden() {
        ResponseEntity<Map> res = get("/api/dashboard/summary?yearMonth=2026-10", support.employeeToken());
        assertEquals(403, res.getStatusCodeValue());
    }
}
