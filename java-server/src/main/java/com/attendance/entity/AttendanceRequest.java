package com.attendance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 请假/加班申请表（attendance_requests）
 * 审批状态机：pending → approved/pending_dept → entered；或 → rejected
 */
@Data
@TableName("attendance_requests")
public class AttendanceRequest {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String type;
    private String subtype;
    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal days;
    private Integer overtimeUnitsUsed;
    private String leaveTypeUsed;
    private String reason;
    private Long projectId;
    private String status;
    private Long teamLeadId;
    private String teamLeadComment;
    private LocalDateTime teamLeadTime;
    private Long deptManagerId;
    private String deptManagerComment;
    private LocalDateTime deptManagerTime;
    private Long managerId;
    private String managerComment;
    private LocalDateTime managerTime;
    private Integer needsDeptManager;
    private Integer isResetBefore;
    private LocalDateTime createdAt;
    private String createdBy;
    private LocalDateTime updatedAt;
    private String updatedBy;
    private LocalDateTime approvedAt;
    private String approvedBy;
    private LocalDateTime rejectedAt;
    private String rejectedBy;
    private BigDecimal annualDays;
}
