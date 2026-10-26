package com.attendance;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 无责任迟到/早退抵扣（等价需求测试）
 * 规则：迟到 08:21-09:00、早退 16:21-17:00 可用；既迟到又早退按 2 次计；每月 3 次
 */
class NoFaultOffsetTest extends BaseTest {

    private String today;
    private String admin;

    private void prepare(String checkIn, String checkOut) {
        support.seed();
        today = LocalDate.now().toString();
        admin = support.adminToken();
        support.db().update("INSERT INTO attendance_records (user_id, work_date, check_in, check_out, effective_hours, is_shortage) VALUES (3, ?, ?, ?, 8.67, 1)",
                today, checkIn, checkOut);
    }

    private Map<String, Object> offsetBody() {
        Map<String, Object> m = new HashMap<>();
        m.put("userId", 3);
        m.put("date", today);
        m.put("offsetType", "no_fault");
        return m;
    }

    private double noFaultRemaining() {
        ResponseEntity<Map> res = get("/api/leave/3", admin);
        @SuppressWarnings("unchecked")
        List<Map> list = (List<Map>) res.getBody().get("list");
        Map nf = list.stream().filter(b -> "no_fault".equals(b.get("leave_type"))).findFirst().orElse(null);
        assertNotNull(nf, "应存在无责任抵扣余额记录");
        return ((Number) nf.get("entitled_days")).doubleValue() - ((Number) nf.get("used_days")).doubleValue();
    }

    @Test
    void lateWithinRangeSuccess() {
        prepare("08:40", "17:00"); // 迟到 20 分钟
        assertEquals(200, put("/api/attendance/offset", admin, offsetBody()).getStatusCodeValue());
        assertEquals(2.0, noFaultRemaining(), 0.001);
    }

    @Test
    void earlyWithinRangeSuccess() {
        prepare("08:20", "16:40"); // 早退 20 分钟
        assertEquals(200, put("/api/attendance/offset", admin, offsetBody()).getStatusCodeValue());
        assertEquals(2.0, noFaultRemaining(), 0.001);
    }

    @Test
    void lateOutOfRangeRejected() {
        prepare("09:01", "17:00"); // 迟到 41 分钟 > 09:00
        ResponseEntity<Map> res = put("/api/attendance/offset", admin, offsetBody());
        assertEquals(400, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("不在无责任抵扣范围内"));
    }

    @Test
    void bothLateAndEarlyConsumesTwo() {
        prepare("08:40", "16:40"); // 迟到 20 + 早退 20 → 2 次
        assertEquals(200, put("/api/attendance/offset", admin, offsetBody()).getStatusCodeValue());
        assertEquals(1.0, noFaultRemaining(), 0.001);
    }

    @Test
    void noChanceLeftRejected() {
        prepare("08:40", "17:00");
        // 直接写入已用尽 3 次的余额记录（惰性创建前需显式插入）
        support.db().update("INSERT INTO leave_balances (user_id, leave_type, year, month, entitled_days, used_days) VALUES (3, 'no_fault', ?, ?, 3, 3)",
                LocalDate.now().getYear(), LocalDate.now().getMonthValue());
        ResponseEntity<Map> res = put("/api/attendance/offset", admin, offsetBody());
        assertEquals(400, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("本月无责任抵扣次数已用完"));
    }

    @Test
    void noPunchRecordRejected() {
        // 旷工（无 attendance_records 记录）→ 明确 400，而非 500
        support.seed();
        today = LocalDate.now().toString();
        admin = support.adminToken();
        ResponseEntity<Map> res = put("/api/attendance/offset", admin, offsetBody());
        assertEquals(400, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("当天无打卡记录"));
    }

    @Test
    void dashboardShowsNoFaultLabel() {
        prepare("08:40", "17:00");
        put("/api/attendance/offset", admin, offsetBody());

        String ym = today.substring(0, 7);
        ResponseEntity<Map> res = get("/api/dashboard/summary?yearMonth=" + ym, admin);
        assertEquals(200, res.getStatusCodeValue());
        @SuppressWarnings("unchecked")
        List<Map> list = (List<Map>) res.getBody().get("list");
        Map alice = list.stream().filter(s -> "爱丽丝".equals(s.get("userName"))).findFirst().orElse(null);
        assertNotNull(alice);
        @SuppressWarnings("unchecked")
        List<Map> details = (List<Map>) alice.get("dailyDetails");
        Map day = details.stream().filter(d -> today.equals(d.get("date"))).findFirst().orElse(null);
        assertNotNull(day);
        assertEquals("正常-无责任", day.get("offsetLabel"));
    }
}
