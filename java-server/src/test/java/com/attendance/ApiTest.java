package com.attendance;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 健康检查与登录接口（等价 Node 版 tests/api.test.js）
 */
class ApiTest extends BaseTest {

    @Test
    void health() {
        ResponseEntity<Map> res = get("/api/health", null);
        assertEquals(200, res.getStatusCodeValue());
        assertEquals("ok", res.getBody().get("status"));
        assertNotNull(res.getBody().get("timestamp"));
    }

    @Test
    void loginMissingFields400() {
        ResponseEntity<Map> res = post("/api/auth/login", null, new java.util.HashMap<>());
        assertEquals(400, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).matches(".*不能为空.*"));
    }

    @Test
    void loginWrongPassword401() {
        ResponseEntity<Map> res = post("/api/auth/login", null, body("admin", "wrong-password"));
        assertEquals(401, res.getStatusCodeValue());
        assertTrue(String.valueOf(res.getBody().get("message")).matches(".*用户名或密码错误.*"));
    }

    @Test
    void loginAdminSuccess() {
        ResponseEntity<Map> res = post("/api/auth/login", null, body("admin", "admin123"));
        assertEquals(200, res.getStatusCodeValue());
        assertNotNull(res.getBody().get("token"));
        assertTrue(String.valueOf(res.getBody().get("token")).length() > 20);
        Map user = (Map) res.getBody().get("user");
        assertEquals("admin", user.get("username"));
        assertEquals("manager", user.get("role"));
        assertNotNull(user.get("id"));
    }

    @Test
    void meWithToken() {
        String token = login("admin", "admin123");
        ResponseEntity<Map> res = get("/api/auth/me", token);
        assertEquals(200, res.getStatusCodeValue());
        assertEquals("admin", ((Map) res.getBody().get("user")).get("username"));
    }

    @Test
    void meWithoutToken401() {
        ResponseEntity<Map> res = get("/api/auth/me", null);
        assertEquals(401, res.getStatusCodeValue());
    }

    private Map<String, Object> body(String u, String p) {
        Map<String, Object> m = new java.util.HashMap<>();
        m.put("username", u);
        m.put("password", p);
        return m;
    }
}
