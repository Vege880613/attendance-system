package com.attendance;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 申请/审批接口（等价 Node 版 tests/requests.test.js）
 */
class RequestsTest extends BaseTest {

    private Map<String, Object> annualBody(int days, int offsetDays) {
        java.time.LocalDate start = java.time.LocalDate.now().plusDays(offsetDays);
        java.time.LocalDate end = start.plusDays(days - 1);
        Map<String, Object> m = new HashMap<>();
        m.put("type", "leave");
        m.put("start_date", start.toString());
        m.put("end_date", end.toString());
        m.put("days", days);
        m.put("leave_type_used", "annual");
        m.put("reason", "测试年假申请");
        return m;
    }

    private Map<String, Object> overtimeBody() {
        Map<String, Object> m = new HashMap<>();
        m.put("type", "overtime");
        m.put("start_date", java.time.LocalDate.now().toString());
        m.put("end_date", java.time.LocalDate.now().toString());
        m.put("days", 6);
        m.put("leave_type_used", "none");
        m.put("project_id", 1);
        m.put("reason", "周末加班");
        return m;
    }

    @Test
    void createMissingFields400() {
        support.seed();
        Map<String, Object> m = new HashMap<>();
        m.put("type", "leave");
        assertEquals(400, post("/api/requests", support.employeeToken(), m).getStatusCodeValue());
    }

    @Test
    void overtimeNeedsProject400() {
        support.seed();
        Map<String, Object> m = new HashMap<>();
        m.put("type", "overtime");
        m.put("start_date", "2026-11-01");
        m.put("end_date", "2026-11-01");
        ResponseEntity<Map> res = post("/api/requests", support.employeeToken(), m);
        assertEquals(400, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("必须选择项目"));
    }

    @Test
    void annualInsufficient400() {
        support.seed();
        ResponseEntity<Map> res = post("/api/requests", support.employeeToken(), annualBody(10, 20));
        assertEquals(400, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("年假余额不足"));
    }

    @Test
    void createAnnualSuccess() {
        support.seed();
        ResponseEntity<Map> res = post("/api/requests", support.employeeToken(), annualBody(1, 1));
        assertEquals(200, res.getStatusCodeValue());
        assertNotNull(res.getBody().get("id"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void mine() {
        support.seed();
        post("/api/requests", support.employeeToken(), annualBody(1, 5));
        ResponseEntity<Map> res = get("/api/requests/mine", support.employeeToken());
        assertEquals(200, res.getStatusCodeValue());
        List<Map> list = (List<Map>) res.getBody().get("list");
        assertTrue(list.size() >= 1);
        assertEquals(3, ((Number) list.get(0).get("user_id")).intValue());
    }

    @Test
    void fullApprovalFlow() {
        support.seed();
        String emp = support.employeeToken();
        String lead = support.teamLeadToken();
        String admin = support.adminToken();

        ResponseEntity<Map> create = post("/api/requests", emp, annualBody(2, 10));
        assertEquals(200, create.getStatusCodeValue());
        Long requestId = ((Number) create.getBody().get("id")).longValue();

        // 组长在 review 列表可见
        ResponseEntity<Map> review = get("/api/requests/review", lead);
        assertEquals(200, review.getStatusCodeValue());
        @SuppressWarnings("unchecked")
        Map found = ((List<Map>) review.getBody().get("list")).stream()
                .filter(r -> ((Number) r.get("id")).longValue() == requestId.longValue()).findFirst().orElse(null);
        assertNotNull(found);
        assertEquals("pending", found.get("status"));

        // 组长审核通过（<3 天直接 approved）
        Map<String, Object> action = new HashMap<>();
        action.put("action", "approve");
        action.put("comment", "同意");
        ResponseEntity<Map> approved = put("/api/requests/" + requestId + "/review", lead, action);
        assertEquals(200, approved.getStatusCodeValue());
        assertTrue(String.valueOf(approved.getBody().get("message")).matches("审核通过"));

        // 管理员确认录入 → 年假扣减
        Map<String, Object> confirm = new HashMap<>();
        confirm.put("action", "approve");
        confirm.put("comment", "确认");
        ResponseEntity<Map> entered = put("/api/requests/" + requestId + "/confirm", admin, confirm);
        assertEquals(200, entered.getStatusCodeValue());
        assertEquals("已确认录入", entered.getBody().get("message"));

        ResponseEntity<Map> bal = get("/api/leave/3", admin);
        @SuppressWarnings("unchecked")
        Map annual = ((List<Map>) bal.getBody().get("list")).stream()
                .filter(b -> "annual".equals(b.get("leave_type"))).findFirst().orElse(null);
        assertNotNull(annual);
        double remaining = ((Number) annual.get("entitled_days")).doubleValue() - ((Number) annual.get("used_days")).doubleValue();
        assertEquals(3.0, remaining, 0.01);
    }

    @Test
    void rejectScenario() {
        support.seed();
        String emp = support.employeeToken();
        String lead = support.teamLeadToken();
        ResponseEntity<Map> create = post("/api/requests", emp, annualBody(1, 15));
        Long id = ((Number) create.getBody().get("id")).longValue();

        Map<String, Object> action = new HashMap<>();
        action.put("action", "reject");
        action.put("comment", "工作繁忙");
        ResponseEntity<Map> rejected = put("/api/requests/" + id + "/review", lead, action);
        assertEquals(200, rejected.getStatusCodeValue());
        assertEquals("已驳回", rejected.getBody().get("message"));

        Map<String, Object> again = new HashMap<>();
        again.put("action", "approve");
        ResponseEntity<Map> res = put("/api/requests/" + id + "/review", lead, again);
        assertEquals(400, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("已处理"));
    }

    @Test
    void overtimeApprovalGeneratesUnits() {
        support.seed();
        String emp = support.employeeToken();
        String lead = support.teamLeadToken();
        String admin = support.adminToken();

        ResponseEntity<Map> create = post("/api/requests", emp, overtimeBody());
        assertEquals(200, create.getStatusCodeValue());
        Long id = ((Number) create.getBody().get("id")).longValue();

        Map<String, Object> action = new HashMap<>();
        action.put("action", "approve");
        put("/api/requests/" + id + "/review", lead, action);

        Map<String, Object> confirm = new HashMap<>();
        confirm.put("action", "approve");
        ResponseEntity<Map> entered = put("/api/requests/" + id + "/confirm", admin, confirm);
        assertEquals(200, entered.getStatusCodeValue());

        List<Map<String, Object>> units = support.db().queryForList("SELECT * FROM overtime_units WHERE request_id = " + id);
        assertFalse(units.isEmpty());
        units.forEach(u -> {
            assertEquals(Long.valueOf(3), u.get("user_id"));
            assertEquals("approved", u.get("status"));
        });
    }
}
