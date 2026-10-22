package com.attendance;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 节假日接口（等价 Node 版 tests/holidays.test.js）
 */
class HolidaysTest extends BaseTest {

    @BeforeEach
    void setUpData() {
        support.seed();
        support.db().update("INSERT INTO holidays (date, name, type, year) VALUES ('2026-10-01', '国庆节', 'holiday', 2026)");
    }

    @Test
    @SuppressWarnings("unchecked")
    void list() {
        ResponseEntity<Map> res = get("/api/holidays", support.adminToken());
        assertEquals(200, res.getStatusCodeValue());
        List<Map> list = (List<Map>) res.getBody().get("list");
        assertTrue(list.stream().anyMatch(h -> "国庆节".equals(h.get("name"))));
    }

    @Test
    @SuppressWarnings("unchecked")
    void filterByYear() {
        ResponseEntity<Map> res = get("/api/holidays?year=2026", support.adminToken());
        assertEquals(200, res.getStatusCodeValue());
        List<Map> list = (List<Map>) res.getBody().get("list");
        assertTrue(list.stream().allMatch(h -> Integer.valueOf(2026).equals(h.get("year"))));
    }

    @Test
    void employeeCanView() {
        assertEquals(200, get("/api/holidays", support.employeeToken()).getStatusCodeValue());
    }

    @Test
    void createSuccess() {
        Map<String, Object> body = new HashMap<>();
        body.put("date", "2026-01-01");
        body.put("name", "元旦");
        body.put("type", "holiday");
        body.put("year", 2026);
        ResponseEntity<Map> res = post("/api/holidays", support.adminToken(), body);
        assertEquals(200, res.getStatusCodeValue());
        assertNotNull(res.getBody().get("id"));
    }

    @Test
    void createMissingFields400() {
        Map<String, Object> body = new HashMap<>();
        body.put("date", "2026-01-01");
        ResponseEntity<Map> res = post("/api/holidays", support.adminToken(), body);
        assertEquals(400, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("缺少必要字段"));
    }

    @Test
    void createDuplicateDate400() {
        Map<String, Object> body = new HashMap<>();
        body.put("date", "2026-10-01");
        body.put("name", "重复");
        body.put("type", "holiday");
        body.put("year", 2026);
        ResponseEntity<Map> res = post("/api/holidays", support.adminToken(), body);
        assertEquals(400, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("该日期已存在"));
    }

    @Test
    void createForbiddenForEmployee() {
        Map<String, Object> body = new HashMap<>();
        body.put("date", "2026-12-25");
        body.put("name", "圣诞");
        body.put("type", "holiday");
        body.put("year", 2026);
        assertEquals(403, post("/api/holidays", support.employeeToken(), body).getStatusCodeValue());
    }

    @Test
    void deleteSuccess() {
        Long id = support.db().queryForObject("SELECT id FROM holidays WHERE date='2026-10-01'", Long.class);
        ResponseEntity<Map> res = delete("/api/holidays/" + id, support.adminToken());
        assertEquals(200, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("删除成功"));
    }

    @Test
    void deleteForbiddenForEmployee() {
        Long id = support.db().queryForObject("SELECT id FROM holidays WHERE date='2026-10-01'", Long.class);
        assertEquals(403, delete("/api/holidays/" + id, support.employeeToken()).getStatusCodeValue());
    }
}
