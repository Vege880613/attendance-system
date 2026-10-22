package com.attendance;

import com.attendance.support.TestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.ResponseErrorHandler;

import org.springframework.http.client.ClientHttpResponse;

import java.util.HashMap;
import java.util.Map;

/**
 * 集成测试基类：启动完整 Spring 上下文（随机端口）+ 测试库 attendance_test
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
public abstract class BaseTest {

    @LocalServerPort
    protected int port;

    @Autowired
    protected TestSupport support;

    protected RestTemplate rest;

    @BeforeEach
    void setUp() {
        rest = new RestTemplate(new org.springframework.http.client.HttpComponentsClientHttpRequestFactory());
        // 不因 4xx/5xx 抛异常，便于断言状态码与响应体
        rest.setErrorHandler(new ResponseErrorHandler() {
            @Override
            public boolean hasError(ClientHttpResponse response) {
                return false;
            }

            @Override
            public void handleError(ClientHttpResponse response) {
            }
        });
    }

    protected String url(String path) {
        return "http://localhost:" + port + path;
    }

    protected HttpHeaders headers(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) h.set("Authorization", "Bearer " + token);
        return h;
    }

    protected ResponseEntity<Map> get(String path, String token) {
        return rest.exchange(url(path), HttpMethod.GET, new HttpEntity<>(headers(token)), Map.class);
    }

    protected ResponseEntity<Map> post(String path, String token, Map body) {
        return rest.exchange(url(path), HttpMethod.POST, new HttpEntity<>(body, headers(token)), Map.class);
    }

    protected ResponseEntity<Map> put(String path, String token, Map body) {
        return rest.exchange(url(path), HttpMethod.PUT, new HttpEntity<>(body, headers(token)), Map.class);
    }

    protected ResponseEntity<Map> delete(String path, String token) {
        return rest.exchange(url(path), HttpMethod.DELETE, new HttpEntity<>(headers(token)), Map.class);
    }

    /** 原始字符串响应（用于 CSV/二进制） */
    protected ResponseEntity<String> getRaw(String path, String token) {
        return rest.exchange(url(path), HttpMethod.GET, new HttpEntity<>(headers(token)), String.class);
    }

    /** 登录并返回 token（走真实接口） */
    protected String login(String username, String password) {
        Map<String, Object> body = new HashMap<>();
        body.put("username", username);
        body.put("password", password);
        ResponseEntity<Map> res = post("/api/auth/login", null, body);
        return (String) res.getBody().get("token");
    }
}
