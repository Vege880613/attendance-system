package com.attendance;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 假期接口（等价 Node 版 tests/leave.test.js）
 */
class LeaveTest extends BaseTest {

    @Test
    @SuppressWarnings("unchecked")
    void employeeOwnBalance() {
        support.seed();
        ResponseEntity<Map> res = get("/api/leave/3", support.employeeToken());
        assertEquals(200, res.getStatusCodeValue());
        List<Map> list = (List<Map>) res.getBody().get("list");
        Map annual = list.stream().filter(b -> "annual".equals(b.get("leave_type"))).findFirst().orElse(null);
        assertNotNull(annual);
        assertEquals(5.0, ((Number) annual.get("entitled_days")).doubleValue());
        assertEquals(0.0, ((Number) annual.get("used_days")).doubleValue());
    }

    @Test
    void employeeQueryOthers403() {
        support.seed();
        assertEquals(403, get("/api/leave/1", support.employeeToken()).getStatusCodeValue());
    }

    @Test
    @SuppressWarnings("unchecked")
    void adminQueryAny() {
        support.seed();
        ResponseEntity<Map> res = get("/api/leave/3", support.adminToken());
        assertEquals(200, res.getStatusCodeValue());
        List<Map> list = (List<Map>) res.getBody().get("list");
        assertTrue(list.size() >= 3);
    }

    @Test
    void annualInitSuccess() {
        support.seed();
        Map<String, Object> body = new HashMap<>();
        body.put("year", java.time.LocalDate.now().getYear());
        ResponseEntity<Map> res = post("/api/leave/annual/init", support.adminToken(), body);
        assertEquals(200, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("年假初始化完成"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void afterInitEntitled() {
        support.seed();
        Map<String, Object> body = new HashMap<>();
        body.put("year", java.time.LocalDate.now().getYear());
        post("/api/leave/annual/init", support.adminToken(), body);
        ResponseEntity<Map> res = get("/api/leave/3", support.adminToken());
        List<Map> list = (List<Map>) res.getBody().get("list");
        Map annual = list.stream().filter(b -> "annual".equals(b.get("leave_type"))).findFirst().orElse(null);
        assertNotNull(annual);
        assertTrue(((Number) annual.get("entitled_days")).doubleValue() >= 0);
    }

    @Test
    void annualClear() {
        support.seed();
        int year = java.time.LocalDate.now().getYear() - 1;
        Map<String, Object> body = new HashMap<>();
        body.put("year", year);
        post("/api/leave/annual/init", support.adminToken(), body);
        ResponseEntity<Map> res = post("/api/leave/annual/clear", support.adminToken(), body);
        assertEquals(200, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("已清理"));
    }
}
