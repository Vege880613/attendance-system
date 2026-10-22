package com.attendance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 考勤记录表（attendance_records）
 */
@Data
@TableName("attendance_records")
public class AttendanceRecord {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private LocalDate workDate;
    private String checkIn;
    private String checkOut;
    private BigDecimal effectiveHours;
    private BigDecimal standardHours;
    private Integer isShortage;
    private String offsetType;
    private BigDecimal offsetUnits;
    private Integer isResetBefore;
    private String remark;
    private LocalDateTime createdAt;
    private String createdBy;
    private LocalDateTime updatedAt;
    private String updatedBy;
    private LocalDateTime approvedAt;
    private String approvedBy;
    private LocalDateTime rejectedAt;
    private String rejectedBy;
}
