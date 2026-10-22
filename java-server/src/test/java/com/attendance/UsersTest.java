package com.attendance;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 用户接口（等价 Node 版 tests/users.test.js）
 */
class UsersTest extends BaseTest {

    @BeforeEach
    void setUpData() {
        support.seed();
    }

    private String admin() {
        return support.adminToken();
    }

    private String emp() {
        return support.employeeToken();
    }

    @Test
    @SuppressWarnings("unchecked")
    void listFull() {
        ResponseEntity<Map> res = get("/api/users", admin());
        assertEquals(200, res.getStatusCodeValue());
        List<Map> list = (List<Map>) res.getBody().get("list");
        assertTrue(list.size() >= 3);
    }

    @Test
    @SuppressWarnings("unchecked")
    void searchByKeyword() {
        ResponseEntity<Map> res = get("/api/users?keyword=admin", admin());
        assertEquals(200, res.getStatusCodeValue());
        List<Map> list = (List<Map>) res.getBody().get("list");
        assertTrue(list.stream().anyMatch(u -> "admin".equals(u.get("username"))));
    }

    @Test
    @SuppressWarnings("unchecked")
    void filterByRole() {
        ResponseEntity<Map> res = get("/api/users?role=employee", admin());
        assertEquals(200, res.getStatusCodeValue());
        List<Map> list = (List<Map>) res.getBody().get("list");
        assertTrue(list.stream().allMatch(u -> "employee".equals(u.get("role"))));
    }

    @Test
    @SuppressWarnings("unchecked")
    void employeeCanList() {
        ResponseEntity<Map> res = get("/api/users", emp());
        assertEquals(200, res.getStatusCodeValue());
        assertNotNull(res.getBody().get("list"));
    }

    @Test
    void unauthenticated401() {
        assertEquals(401, get("/api/users", null).getStatusCodeValue());
    }

    @Test
    @SuppressWarnings("unchecked")
    void createSuccess() {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("username", "newbie");
        body.put("password", "123456");
        body.put("name", "新员工");
        body.put("role", "employee");
        body.put("hire_date", "2024-01-01");
        ResponseEntity<Map> res = post("/api/users", admin(), body);
        assertEquals(200, res.getStatusCodeValue());
        assertNotNull(res.getBody().get("id"));
        assertTrue(String.valueOf(res.getBody().get("message")).contains("创建成功"));
    }

    @Test
    void createMissingFields400() {
        ResponseEntity<Map> res = post("/api/users", admin(), new java.util.HashMap<>());
        assertEquals(400, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("缺少必要字段"));
    }

    @Test
    void createDuplicateUsername400() {
        ResponseEntity<Map> res = post("/api/users", admin(), dupBody());
        assertEquals(400, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("用户名已存在"));
    }

    @Test
    void createForbiddenForEmployee() {
        ResponseEntity<Map> res = post("/api/users", emp(), dupBody());
        assertEquals(403, res.getStatusCodeValue());
    }

    @Test
    void updateSuccess() {
        ResponseEntity<Map> res = put("/api/users/3", admin(), updateBody());
        assertEquals(200, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("更新成功"));
    }

    @Test
    void updateStatusResigned() {
        ResponseEntity<Map> res = put("/api/users/3/status", admin(), statusBody("resigned"));
        assertEquals(200, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("状态更新成功"));
    }

    @Test
    void updateStatusInvalid400() {
        ResponseEntity<Map> res = put("/api/users/3/status", admin(), statusBody("bogus"));
        assertEquals(400, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("状态不合法"));
    }

    @Test
    void exportAdmin() {
        ResponseEntity<String> res = getRaw("/api/users/export", admin());
        assertEquals(200, res.getStatusCodeValue());
        assertTrue(res.getHeaders().getContentType().toString().contains("text/csv"));
        assertTrue(res.getBody().contains("username"));
    }

    @Test
    void exportForbiddenForEmployee() {
        assertEquals(403, getRaw("/api/users/export", emp()).getStatusCodeValue());
    }

    private Map<String, Object> dupBody() {
        Map<String, Object> m = new java.util.HashMap<>();
        m.put("username", "admin");
        m.put("password", "123456");
        m.put("name", "重复");
        m.put("hire_date", "2024-01-01");
        return m;
    }

    private Map<String, Object> updateBody() {
        Map<String, Object> m = new java.util.HashMap<>();
        m.put("name", "爱丽丝改名");
        m.put("role", "employee");
        m.put("team_id", 1);
        m.put("hire_date", "2020-06-15");
        return m;
    }

    private Map<String, Object> statusBody(String status) {
        Map<String, Object> m = new java.util.HashMap<>();
        m.put("status", status);
        return m;
    }
}
