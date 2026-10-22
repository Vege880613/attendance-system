package com.attendance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 用户表（users）
 * map-underscore-to-camel-case: true 自动完成 snake_case ↔ 驼峰映射
 */
@Data
@TableName("users")
public class User {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String username;

    @JsonIgnore
    private String passwordHash;

    private String name;
    private String role;
    private Long teamId;
    private LocalDate hireDate;
    private String status;
    private String employeeId;
    private LocalDate companyHireDate;
    private LocalDateTime createdAt;
    private String createdBy;
    private LocalDateTime updatedAt;
    private String updatedBy;
}
