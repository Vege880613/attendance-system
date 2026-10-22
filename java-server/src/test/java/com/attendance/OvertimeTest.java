package com.attendance;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 加班接口（等价 Node 版 tests/overtime.test.js）
 */
class OvertimeTest extends BaseTest {

    @BeforeEach
    void setUpData() {
        support.seed();
        support.db().update("DELETE FROM overtime_units");
        support.db().update("INSERT INTO overtime_units (user_id, work_date, hours, units_count, status) VALUES (3, '2026-06-01', 3, 1, 'approved')");
        support.db().update("INSERT INTO overtime_units (user_id, work_date, hours, units_count, status) VALUES (3, '2026-06-02', 6, 2, 'approved')");
        support.db().update("INSERT INTO overtime_units (user_id, work_date, hours, units_count, status) VALUES (3, '2026-06-03', 3, 1, 'pending')");
    }

    @Test
    @SuppressWarnings("unchecked")
    void employeeOnlyOwn() {
        ResponseEntity<Map> res = get("/api/overtime", support.employeeToken());
        assertEquals(200, res.getStatusCodeValue());
        List<Map> list = (List<Map>) res.getBody().get("list");
        assertEquals(3, list.size());
        assertTrue(list.stream().allMatch(o -> ((Number) o.get("user_id")).longValue() == 3));
    }

    @Test
    @SuppressWarnings("unchecked")
    void adminFilterByStatus() {
        ResponseEntity<Map> res = get("/api/overtime?status=approved", support.adminToken());
        assertEquals(200, res.getStatusCodeValue());
        List<Map> list = (List<Map>) res.getBody().get("list");
        assertTrue(list.stream().allMatch(o -> "approved".equals(o.get("status"))));
    }

    @Test
    @SuppressWarnings("unchecked")
    void adminFilterByUserId() {
        ResponseEntity<Map> res = get("/api/overtime?userId=3", support.adminToken());
        assertEquals(200, res.getStatusCodeValue());
        List<Map> list = (List<Map>) res.getBody().get("list");
        assertTrue(list.stream().allMatch(o -> ((Number) o.get("user_id")).longValue() == 3));
    }

    @Test
    void unauthenticated401() {
        assertEquals(401, get("/api/overtime", null).getStatusCodeValue());
    }

    @Test
    @SuppressWarnings("unchecked")
    void availableReturnsApproved() {
        ResponseEntity<Map> res = get("/api/overtime/available/3", support.employeeToken());
        assertEquals(200, res.getStatusCodeValue());
        List<Map> list = (List<Map>) res.getBody().get("list");
        assertTrue(list.stream().allMatch(o -> "approved".equals(o.get("status"))));
        assertEquals(2, list.size());
    }

    @Test
    void exportAdmin() {
        ResponseEntity<String> res = getRaw("/api/overtime/export", support.adminToken());
        assertEquals(200, res.getStatusCodeValue());
        assertTrue(res.getHeaders().getContentType().toString().contains("text/csv"));
        assertTrue(res.getBody().contains("user_name"));
    }

    @Test
    void exportForbiddenForEmployee() {
        assertEquals(403, getRaw("/api/overtime/export", support.employeeToken()).getStatusCodeValue());
    }
}
