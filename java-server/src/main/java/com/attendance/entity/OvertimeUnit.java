package com.attendance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 加班单位表（overtime_units）
 */
@Data
@TableName("overtime_units")
public class OvertimeUnit {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private LocalDate workDate;
    private BigDecimal hours;
    private Integer unitsCount;
    private String status;
    private Long requestId;
    private Long leaveRequestId;
    private String leaveTypeMark;
    private String leaveDates;
    private LocalDateTime createdAt;
    private String createdBy;
    private LocalDateTime updatedAt;
    private String updatedBy;
    private LocalDateTime approvedAt;
    private String approvedBy;
    private LocalDateTime rejectedAt;
    private String rejectedBy;
}
