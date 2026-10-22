package com.attendance.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 全局异常处理：统一输出 { "message": "..." }（与 Node 版一致）
 * 前端 axios 拦截器读取 response.data.message 显示 toast
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BizException.class)
    public ResponseEntity<Map<String, Object>> handleBiz(BizException e) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", e.getMessage());
        return ResponseEntity.status(e.getCode()).body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleOther(Exception e) {
        log.error("服务器内部错误", e);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "服务器内部错误");
        body.put("detail", e.getMessage());
        return ResponseEntity.status(500).body(body);
    }
}
