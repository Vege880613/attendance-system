package com.attendance;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 考勤系统 Java 后端启动类
 * 无损替换 Node.js/Express 版本，保持 API 契约与前端零改动
 */
@SpringBootApplication
@MapperScan("com.attendance.mapper")
public class AttendanceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AttendanceApplication.class, args);
    }
}
