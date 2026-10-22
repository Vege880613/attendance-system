package com.attendance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 节假日表（holidays）
 */
@Data
@TableName("holidays")
public class Holiday {

    @TableId(type = IdType.AUTO)
    private Long id;
    private LocalDate date;
    private String name;
    private String type;
    private Integer year;
    private LocalDateTime createdAt;
    private String createdBy;
    private LocalDateTime updatedAt;
    private String updatedBy;
}
