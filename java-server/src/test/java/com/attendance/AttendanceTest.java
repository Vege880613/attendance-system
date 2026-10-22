package com.attendance;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 考勤接口（等价 Node 版 tests/attendance.test.js）
 */
class AttendanceTest extends BaseTest {

    private final String yearMonth = java.time.LocalDate.now().toString().substring(0, 7);

    private Map<String, Object> record(int day, String in, String out) {
        Map<String, Object> r = new HashMap<>();
        r.put("user_id", 3);
        r.put("day", day);
        r.put("check_in", in);
        r.put("check_out", out);
        r.put("remark", "");
        return r;
    }

    @Test
    void batchForbiddenForEmployee() {
        support.seed();
        Map<String, Object> body = new HashMap<>();
        body.put("yearMonth", yearMonth);
        body.put("records", new ArrayList<>());
        assertEquals(403, post("/api/attendance/batch", support.employeeToken(), body).getStatusCodeValue());
    }

    @Test
    void batchInvalidParams400() {
        support.seed();
        Map<String, Object> body = new HashMap<>();
        body.put("yearMonth", yearMonth);
        assertEquals(400, post("/api/attendance/batch", support.adminToken(), body).getStatusCodeValue());
    }

    @Test
    void batchSuccess() {
        support.seed();
        List<Map<String, Object>> records = new ArrayList<>();
        records.add(record(1, "08:15", "17:30"));
        records.add(record(2, "09:00", "17:00"));
        Map<String, Object> body = new HashMap<>();
        body.put("yearMonth", yearMonth);
        body.put("records", records);
        ResponseEntity<Map> res = post("/api/attendance/batch", support.adminToken(), body);
        assertEquals(200, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).matches(".*成功录入 2 条.*"));
    }

    @Test
    void listMissingYearMonth400() {
        support.seed();
        assertEquals(400, get("/api/attendance", support.adminToken()).getStatusCodeValue());
    }

    @Test
    @SuppressWarnings("unchecked")
    void listAdmin() {
        support.seed();
        ResponseEntity<Map> res = get("/api/attendance?yearMonth=" + yearMonth, support.adminToken());
        assertEquals(200, res.getStatusCodeValue());
        assertNotNull(res.getBody().get("list"));
        assertNotNull(res.getBody().get("leaves"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void listEmployeeScoped() {
        support.seed();
        List<Map<String, Object>> records = new ArrayList<>();
        records.add(record(3, "08:20", "17:00"));
        Map<String, Object> body = new HashMap<>();
        body.put("yearMonth", yearMonth);
        body.put("records", records);
        post("/api/attendance/batch", support.adminToken(), body);

        ResponseEntity<Map> res = get("/api/attendance?yearMonth=" + yearMonth, support.employeeToken());
        assertEquals(200, res.getStatusCodeValue());
        List<Map> list = (List<Map>) res.getBody().get("list");
        assertTrue(list.stream().allMatch(r -> ((Number) r.get("user_id")).longValue() == 3));
    }

    @Test
    void offsetMissingParams400() {
        support.seed();
        assertEquals(400, put("/api/attendance/offset", support.adminToken(), new HashMap<>()).getStatusCodeValue());
    }

    @Test
    void offsetAnnualSuccess() {
        support.seed();
        String date = java.time.LocalDate.now().getYear() + "-06-15";
        Map<String, Object> body = new HashMap<>();
        body.put("userId", 3);
        body.put("date", date);
        body.put("offsetType", "annual_leave");
        body.put("offsetUnits", 1);
        ResponseEntity<Map> res = put("/api/attendance/offset", support.adminToken(), body);
        assertEquals(200, res.getStatusCodeValue());
        assertEquals("抵扣成功", res.getBody().get("message"));

        Map<String, Object> body2 = new HashMap<>();
        body2.put("userId", 3);
        body2.put("date", java.time.LocalDate.now().getYear() + "-06-16");
        body2.put("offsetType", "annual_leave");
        body2.put("offsetUnits", 1);
        assertEquals(200, put("/api/attendance/offset", support.adminToken(), body2).getStatusCodeValue());
    }
}
