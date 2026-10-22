package com.attendance;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 班组接口（等价 Node 版 tests/teams.test.js）
 */
class TeamsTest extends BaseTest {

    @BeforeEach
    void setUpData() {
        support.seed();
    }

    @Test
    @SuppressWarnings("unchecked")
    void listWithMemberCount() {
        ResponseEntity<Map> res = get("/api/teams", support.adminToken());
        assertEquals(200, res.getStatusCodeValue());
        List<Map> list = (List<Map>) res.getBody().get("list");
        assertTrue(list.stream().anyMatch(t -> "测试一组".equals(t.get("name"))));
        assertNotNull(list.get(0).get("member_count"));
    }

    @Test
    void employeeCanList() {
        assertEquals(200, get("/api/teams", support.employeeToken()).getStatusCodeValue());
    }

    @Test
    @SuppressWarnings("unchecked")
    void members() {
        ResponseEntity<Map> res = get("/api/teams/1/members", support.adminToken());
        assertEquals(200, res.getStatusCodeValue());
        List<Map> list = (List<Map>) res.getBody().get("list");
        assertTrue(list.stream().anyMatch(u -> "alice".equals(u.get("username"))));
    }

    @Test
    void createSuccess() {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "二组");
        body.put("lead_user_id", 2);
        ResponseEntity<Map> res = post("/api/teams", support.adminToken(), body);
        assertEquals(200, res.getStatusCodeValue());
        assertNotNull(res.getBody().get("id"));
    }

    @Test
    void createEmptyName400() {
        ResponseEntity<Map> res = post("/api/teams", support.adminToken(), new HashMap<>());
        assertEquals(400, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("班组名称不能为空"));
    }

    @Test
    void createForbiddenForEmployee() {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "二组");
        assertEquals(403, post("/api/teams", support.employeeToken(), body).getStatusCodeValue());
    }

    @Test
    void updateSuccess() {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "一组改名");
        body.put("lead_user_id", 2);
        ResponseEntity<Map> res = put("/api/teams/1", support.adminToken(), body);
        assertEquals(200, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("更新成功"));
    }

    @Test
    void exportAdmin() {
        ResponseEntity<String> res = getRaw("/api/teams/export", support.adminToken());
        assertEquals(200, res.getStatusCodeValue());
        assertTrue(res.getHeaders().getContentType().toString().contains("text/csv"));
    }

    @Test
    void exportForbiddenForEmployee() {
        assertEquals(403, getRaw("/api/teams/export", support.employeeToken()).getStatusCodeValue());
    }
}
