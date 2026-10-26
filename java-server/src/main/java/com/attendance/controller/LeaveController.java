package com.attendance.controller;

import com.attendance.common.BizException;
import com.attendance.common.UserContext;
import com.attendance.entity.AttendanceRequest;
import com.attendance.entity.LeaveBalance;
import com.attendance.entity.OvertimeUnit;
import com.attendance.entity.User;
import com.attendance.mapper.AttendanceRequestMapper;
import com.attendance.mapper.LeaveBalanceMapper;
import com.attendance.mapper.OvertimeUnitMapper;
import com.attendance.mapper.UserMapper;
import com.attendance.security.RequireRole;
import com.attendance.util.BusinessRules;
import com.attendance.util.CsvResponse;
import com.attendance.util.CsvUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 假期接口（/api/leave）
 * balance 返回 5 字段：{list, year, companyHireDate, tenureYears, canUseAnnual}
 */
@RestController
@RequestMapping("/api/leave")
public class LeaveController {

    /** 每月无责任迟到/早退抵扣次数 */
    public static final int NO_FAULT_MONTHLY_CHANCES = 3;

    @Resource
    private LeaveBalanceMapper leaveBalanceMapper;
    @Resource
    private OvertimeUnitMapper overtimeUnitMapper;
    @Resource
    private AttendanceRequestMapper attendanceRequestMapper;
    @Resource
    private UserMapper userMapper;

    @GetMapping("/export")
    @RequireRole("manager")
    public ResponseEntity<byte[]> export() {
        int year = LocalDate.now().getYear();
        List<LeaveBalance> balances = leaveBalanceMapper.selectList(
                new QueryWrapper<LeaveBalance>().eq("year", year).orderByAsc("user_id").orderByAsc("leave_type"));
        List<String> columns = java.util.Arrays.asList("user_name", "leave_type", "entitled_days", "used_days", "reset_used_days", "reset_at", "created_at", "created_by", "updated_at", "updated_by");
        List<Map<String, Object>> rows = balances.stream().map(b -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("user_name", userName(b.getUserId()));
            m.put("leave_type", b.getLeaveType());
            m.put("entitled_days", b.getEntitledDays());
            m.put("used_days", b.getUsedDays());
            m.put("reset_used_days", b.getResetUsedDays());
            m.put("reset_at", b.getResetAt());
            m.put("created_at", b.getCreatedAt());
            m.put("created_by", b.getCreatedBy());
            m.put("updated_at", b.getUpdatedAt());
            m.put("updated_by", b.getUpdatedBy());
            return m;
        }).collect(Collectors.toList());
        return CsvResponse.of("leave_balances_export.csv", CsvUtil.render(columns, rows));
    }

    @GetMapping("/{userId}")
    public Map<String, Object> balance(@PathVariable Long userId) {
        if ("employee".equals(UserContext.getRole()) && !userId.equals(UserContext.getUserId())) {
            throw BizException.forbidden("无权查看");
        }
        int year = LocalDate.now().getYear();
        int month = LocalDate.now().getMonthValue();

        // 年度类型（年假/调休/公差/其他）month=0
        List<LeaveBalance> list = leaveBalanceMapper.selectList(
                new QueryWrapper<LeaveBalance>().eq("user_id", userId).eq("year", year).eq("month", 0));

        User user = userMapper.selectById(userId);
        String companyHireDate = user == null ? null : (user.getCompanyHireDate() == null ? null : user.getCompanyHireDate().toString());
        int tenureYears = BusinessRules.companyTenureYears(companyHireDate, year);
        boolean canUseAnnual = BusinessRules.canUseAnnualLeave(companyHireDate, year);

        // 动态计算调休余额（基于全部加班单位）
        Long allOvertime = overtimeUnitMapper.selectCount(new QueryWrapper<OvertimeUnit>()
                .eq("user_id", userId)
                .apply("YEAR(work_date) = {0}", year));
        long totalUnits = allOvertime == null ? 0 : allOvertime;
        double overtimeDays = Math.floor(totalUnits / 3.0) + (totalUnits % 3 > 0 ? 0.5 : 0);

        // 已使用调休天数（只计入 entered 状态）
        List<AttendanceRequest> usedRequests = attendanceRequestMapper.selectList(new QueryWrapper<AttendanceRequest>()
                .eq("user_id", userId)
                .eq("leave_type_used", "compensatory")
                .eq("status", "entered")
                .apply("YEAR(start_date) = {0}", year));
        double usedDays = usedRequests.stream().mapToDouble(r -> r.getDays() == null ? 0 : r.getDays().doubleValue()).sum();

        // 更新或插入 compensatory 记录
        LeaveBalance comp = list.stream().filter(b -> "compensatory".equals(b.getLeaveType())).findFirst().orElse(null);
        if (overtimeDays > 0 || usedDays > 0) {
            if (comp != null) {
                comp.setEntitledDays(BigDecimal.valueOf(overtimeDays));
                comp.setUsedDays(BigDecimal.valueOf(usedDays));
                comp.setUpdatedAt(LocalDateTime.now());
                comp.setUpdatedBy(str(UserContext.getUserId()));
                leaveBalanceMapper.updateById(comp);
            } else {
                comp = new LeaveBalance();
                comp.setUserId(userId);
                comp.setLeaveType("compensatory");
                comp.setYear(year);
                comp.setEntitledDays(BigDecimal.valueOf(overtimeDays));
                comp.setUsedDays(BigDecimal.valueOf(usedDays));
                comp.setCreatedBy(str(UserContext.getUserId()));
                leaveBalanceMapper.insert(comp);
                list.add(comp);
            }
        } else if (comp == null) {
            comp = new LeaveBalance();
            comp.setUserId(userId);
            comp.setLeaveType("compensatory");
            comp.setYear(year);
            comp.setEntitledDays(BigDecimal.ZERO);
            comp.setUsedDays(BigDecimal.ZERO);
            comp.setCreatedBy(str(UserContext.getUserId()));
            leaveBalanceMapper.insert(comp);
            list.add(comp);
        }

        // 确保 business_trip / other 有记录
        for (String type : java.util.Arrays.asList("business_trip", "other")) {
            boolean exists = list.stream().anyMatch(b -> type.equals(b.getLeaveType()));
            if (!exists) {
                list.add(zeroBalance(userId, type, year));
            }
        }

        // 无责任迟到/早退抵扣：按当前年月惰性创建（每月 1 日自动更新为 3 次）
        LeaveBalance noFault = leaveBalanceMapper.selectOne(new QueryWrapper<LeaveBalance>()
                .eq("user_id", userId).eq("leave_type", "no_fault").eq("year", year).eq("month", month));
        if (noFault == null) {
            noFault = new LeaveBalance();
            noFault.setUserId(userId);
            noFault.setLeaveType("no_fault");
            noFault.setYear(year);
            noFault.setMonth(month);
            noFault.setEntitledDays(BigDecimal.valueOf(NO_FAULT_MONTHLY_CHANCES));
            noFault.setUsedDays(BigDecimal.ZERO);
            noFault.setCreatedBy(str(UserContext.getUserId()));
            leaveBalanceMapper.insert(noFault);
        }
        list.add(noFault);

        List<Map<String, Object>> vo = list.stream().map(b -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", b.getId());
            m.put("user_id", b.getUserId());
            m.put("leave_type", b.getLeaveType());
            m.put("year", b.getYear());
            m.put("month", b.getMonth());
            m.put("entitled_days", b.getEntitledDays());
            m.put("used_days", b.getUsedDays());
            m.put("reset_used_days", b.getResetUsedDays());
            m.put("reset_at", b.getResetAt());
            m.put("created_by", b.getCreatedBy());
            m.put("created_at", b.getCreatedAt());
            m.put("updated_at", b.getUpdatedAt());
            m.put("updated_by", b.getUpdatedBy());
            return m;
        }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("list", vo);
        result.put("year", year);
        result.put("companyHireDate", companyHireDate);
        result.put("tenureYears", tenureYears);
        result.put("canUseAnnual", canUseAnnual);
        return result;
    }

    @PostMapping("/annual/init")
    @RequireRole("manager")
    public Map<String, Object> annualInit(@RequestBody Map<String, Object> body) {
        int targetYear = body.get("year") == null ? LocalDate.now().getYear() : Integer.valueOf(str(body.get("year")));
        List<Map<String, Object>> adjustments = body.get("adjustments") == null ? java.util.Arrays.asList()
                : (List<Map<String, Object>>) body.get("adjustments");
        Map<Long, Double> adjustMap = new LinkedHashMap<>();
        for (Map<String, Object> a : adjustments) {
            Long uid = Long.valueOf(str(a.get("userId")));
            Double days = Double.valueOf(str(a.get("entitledDays")));
            adjustMap.put(uid, days);
        }

        List<User> users = userMapper.selectList(new QueryWrapper<User>()
                .eq("status", "active")
                .in("role", java.util.Arrays.asList("employee", "team_lead", "manager")));

        // 标记重置前的记录
        attendanceRequestMapper.update(null, new UpdateWrapper<AttendanceRequest>()
                .set("is_reset_before", 1)
                .eq("type", "leave").eq("status", "entered"));

        for (User u : users) {
            String chd = u.getCompanyHireDate() == null ? null : u.getCompanyHireDate().toString();
            double entitled = adjustMap.containsKey(u.getId()) ? adjustMap.get(u.getId())
                    : BusinessRules.annualLeaveDays(u.getHireDate() == null ? null : u.getHireDate().toString(), targetYear, chd);

            LeaveBalance existing = leaveBalanceMapper.selectOne(new QueryWrapper<LeaveBalance>()
                    .eq("user_id", u.getId()).eq("leave_type", "annual").eq("year", targetYear).eq("month", 0));
            if (existing != null) {
                existing.setResetUsedDays(existing.getUsedDays());
                existing.setEntitledDays(BigDecimal.valueOf(entitled));
                existing.setUsedDays(BigDecimal.ZERO);
                existing.setResetAt(LocalDateTime.now());
                existing.setUpdatedBy(str(UserContext.getUserId()));
                leaveBalanceMapper.updateById(existing);
            } else {
                LeaveBalance b = new LeaveBalance();
                b.setUserId(u.getId());
                b.setLeaveType("annual");
                b.setYear(targetYear);
                b.setMonth(0);
                b.setEntitledDays(BigDecimal.valueOf(entitled));
                b.setUsedDays(BigDecimal.ZERO);
                b.setCreatedBy(str(UserContext.getUserId()));
                leaveBalanceMapper.insert(b);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", targetYear + " 年年假初始化完成");
        return result;
    }

    @PostMapping("/annual/clear")
    @RequireRole("manager")
    public Map<String, Object> annualClear(@RequestBody Map<String, Object> body) {
        int targetYear = body.get("year") == null ? LocalDate.now().getYear() - 1 : Integer.valueOf(str(body.get("year")));
        // 仅清理年度类型（month=0），保留无责任抵扣的月度记录
        leaveBalanceMapper.delete(new QueryWrapper<LeaveBalance>().eq("year", targetYear).eq("month", 0));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", targetYear + " 年度假期已清理");
        return result;
    }

    private LeaveBalance zeroBalance(Long userId, String type, int year) {
        LeaveBalance b = new LeaveBalance();
        b.setUserId(userId);
        b.setLeaveType(type);
        b.setYear(year);
        b.setMonth(0);
        b.setEntitledDays(BigDecimal.ZERO);
        b.setUsedDays(BigDecimal.ZERO);
        return b;
    }

    private String userName(Long userId) {
        User u = userMapper.selectById(userId);
        return u == null ? null : u.getName();
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }
}
