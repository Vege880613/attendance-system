package com.attendance;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 项目接口（等价 Node 版 tests/projects.test.js）
 */
class ProjectsTest extends BaseTest {

    @BeforeEach
    void setUpData() {
        support.seed();
    }

    @Test
    @SuppressWarnings("unchecked")
    void list() {
        ResponseEntity<Map> res = get("/api/projects", support.adminToken());
        assertEquals(200, res.getStatusCodeValue());
        List<Map> list = (List<Map>) res.getBody().get("list");
        assertTrue(list.stream().anyMatch(p -> "项目Alpha".equals(p.get("name"))));
    }

    @Test
    @SuppressWarnings("unchecked")
    void filterByType() {
        ResponseEntity<Map> res = get("/api/projects?type=project", support.adminToken());
        assertEquals(200, res.getStatusCodeValue());
        List<Map> list = (List<Map>) res.getBody().get("list");
        assertTrue(list.stream().allMatch(p -> "project".equals(p.get("type"))));
    }

    @Test
    void employeeCanView() {
        assertEquals(200, get("/api/projects", support.employeeToken()).getStatusCodeValue());
    }

    @Test
    void createSuccess() {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "项目Beta");
        body.put("type", "project");
        body.put("description", "测试");
        ResponseEntity<Map> res = post("/api/projects", support.adminToken(), body);
        assertEquals(200, res.getStatusCodeValue());
        assertNotNull(res.getBody().get("id"));
        assertTrue(String.valueOf(res.getBody().get("message")).contains("创建成功"));
    }

    @Test
    void createEmptyName400() {
        ResponseEntity<Map> res = post("/api/projects", support.adminToken(), new HashMap<>());
        assertEquals(400, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("项目名称不能为空"));
    }

    @Test
    void createForbiddenForEmployee() {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "x");
        assertEquals(403, post("/api/projects", support.employeeToken(), body).getStatusCodeValue());
    }

    @Test
    void createWritesAuditLog() {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "审计项目");
        assertEquals(200, post("/api/projects", support.adminToken(), body).getStatusCodeValue());
        List<Map<String, Object>> logs = support.db().queryForList("SELECT * FROM audit_logs WHERE action = 'create_project'");
        assertFalse(logs.isEmpty());
    }

    @Test
    void updateSuccess() {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "Alpha改名");
        body.put("type", "project");
        body.put("description", "更新");
        body.put("status", "active");
        ResponseEntity<Map> res = put("/api/projects/1", support.adminToken(), body);
        assertEquals(200, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("更新成功"));
    }
}
