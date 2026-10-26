package com.attendance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 假期余额表（leave_balances）
 */
@Data
@TableName("leave_balances")
public class LeaveBalance {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String leaveType;
    private Integer year;
    /** 0=年度类型（年假/调休等），1-12=月度类型（无责任抵扣） */
    private Integer month;
    private BigDecimal entitledDays;
    private BigDecimal usedDays;
    private BigDecimal resetUsedDays;
    private LocalDateTime resetAt;
    private LocalDateTime createdAt;
    private String createdBy;
    private LocalDateTime updatedAt;
    private String updatedBy;
}
