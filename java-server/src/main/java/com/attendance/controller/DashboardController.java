package com.attendance.controller;

import com.attendance.common.BizException;
import com.attendance.common.UserContext;
import com.attendance.entity.AttendanceRecord;
import com.attendance.entity.AttendanceRequest;
import com.attendance.entity.Holiday;
import com.attendance.entity.LeaveBalance;
import com.attendance.entity.OvertimeUnit;
import com.attendance.entity.Team;
import com.attendance.entity.User;
import com.attendance.mapper.AttendanceRecordMapper;
import com.attendance.mapper.AttendanceRequestMapper;
import com.attendance.mapper.HolidayMapper;
import com.attendance.mapper.LeaveBalanceMapper;
import com.attendance.mapper.OvertimeUnitMapper;
import com.attendance.mapper.TeamMapper;
import com.attendance.mapper.UserMapper;
import com.attendance.security.RequireRole;
import com.attendance.util.BusinessRules;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 仪表盘接口（/api/dashboard）
 * 注意：响应字段为 camelCase（与全局 snake_case 不同），用 Map 显式构建
 */
@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    @Resource
    private UserMapper userMapper;
    @Resource
    private TeamMapper teamMapper;
    @Resource
    private AttendanceRecordMapper attendanceRecordMapper;
    @Resource
    private AttendanceRequestMapper attendanceRequestMapper;
    @Resource
    private HolidayMapper holidayMapper;
    @Resource
    private OvertimeUnitMapper overtimeUnitMapper;
    @Resource
    private LeaveBalanceMapper leaveBalanceMapper;

    @GetMapping("/summary")
    @RequireRole({"manager", "team_lead"})
    public Map<String, Object> summary(@RequestParam(required = false) String yearMonth) {
        if (yearMonth == null || yearMonth.isEmpty()) {
            throw BizException.badRequest("请指定年月");
        }
        String[] parts = yearMonth.split("-");
        int year = Integer.parseInt(parts[0]);
        int month = Integer.parseInt(parts[1]);
        int daysInMonth = LocalDate.of(year, month, 1).lengthOfMonth();

        // 用户过滤（员工角色，排除 manager）
        QueryWrapper<User> userQw = new QueryWrapper<User>()
                .eq("status", "active").ne("role", "manager");
        if ("team_lead".equals(UserContext.getRole())) {
            User me = userMapper.selectById(UserContext.getUserId());
            if (me != null && me.getTeamId() != null) userQw.eq("team_id", me.getTeamId());
        }
        userQw.orderByAsc("team_id").orderByAsc("id");
        List<User> users = userMapper.selectList(userQw);

        List<AttendanceRecord> attendanceRecords = attendanceRecordMapper.selectList(new QueryWrapper<AttendanceRecord>()
                .apply("DATE_FORMAT(work_date, '%Y-%m') = {0}", yearMonth));
        List<Holiday> holidays = holidayMapper.selectList(new QueryWrapper<Holiday>()
                .apply("DATE_FORMAT(date, '%Y-%m') = {0}", yearMonth));
        List<AttendanceRequest> leaveRequests = attendanceRequestMapper.selectList(new QueryWrapper<AttendanceRequest>()
                .eq("status", "entered").eq("type", "leave")
                .apply("DATE_FORMAT(start_date, '%Y-%m') <= {0} AND DATE_FORMAT(end_date, '%Y-%m') >= {0}", yearMonth));
        List<OvertimeUnit> overtimeUnits = overtimeUnitMapper.selectList(new QueryWrapper<OvertimeUnit>()
                .apply("DATE_FORMAT(work_date, '%Y-%m') = {0}", yearMonth).in("status", java.util.Arrays.asList("approved", "pending")));
        List<LeaveBalance> leaveBalances = leaveBalanceMapper.selectList(new QueryWrapper<LeaveBalance>().eq("year", year));

        List<Map<String, Object>> list = new ArrayList<>();
        for (User user : users) {
            List<AttendanceRecord> userAtt = attendanceRecords.stream().filter(a -> a.getUserId().equals(user.getId())).collect(Collectors.toList());
            List<AttendanceRequest> userLeaves = leaveRequests.stream().filter(l -> l.getUserId().equals(user.getId())).collect(Collectors.toList());
            List<OvertimeUnit> userOvertime = overtimeUnits.stream().filter(o -> o.getUserId().equals(user.getId())).collect(Collectors.toList());
            List<LeaveBalance> userBalances = leaveBalances.stream().filter(b -> b.getUserId().equals(user.getId())).collect(Collectors.toList());

            List<Map<String, Object>> dailyDetails = new ArrayList<>();
            for (int d = 1; d <= daysInMonth; d++) {
                String dateStr = yearMonth + "-" + String.format("%02d", d);
                LocalDate date = LocalDate.parse(dateStr);
                int dayOfWeek = date.getDayOfWeek().getValue() % 7; // 0=周日
                boolean isWeekend = dayOfWeek == 0 || dayOfWeek == 6;

                Holiday holiday = holidays.stream().filter(h -> h.getDate().equals(date)).findFirst().orElse(null);
                AttendanceRecord att = userAtt.stream().filter(a -> a.getWorkDate().equals(date)).findFirst().orElse(null);
                AttendanceRequest leave = userLeaves.stream().filter(l -> !date.isBefore(l.getStartDate()) && !date.isAfter(l.getEndDate())).findFirst().orElse(null);

                Map<String, Object> detail = new LinkedHashMap<>();
                detail.put("date", dateStr);
                detail.put("dayOfWeek", dayOfWeek);

                if (holiday != null && "holiday".equals(holiday.getType())) {
                    detail.put("type", "holiday");
                    detail.put("status", holiday.getName() == null ? "节假日" : holiday.getName());
                } else if (isWeekend && holiday == null) {
                    detail.put("type", "weekend");
                    detail.put("status", "休息");
                } else if (leave != null) {
                    detail.put("type", "leave");
                    detail.put("status", "请假");
                    detail.put("leaveType", leave.getLeaveTypeUsed());
                    detail.put("leaveTypeName", leaveTypeName(leave.getLeaveTypeUsed()));
                    detail.put("leaveDays", leave.getDays());
                    detail.put("leaveReason", leave.getReason());
                    detail.put("effectiveHours", 0);
                    detail.put("isShortage", false);
                } else if (att != null) {
                    double effectiveHours = att.getEffectiveHours() == null ? 0 : att.getEffectiveHours().doubleValue();
                    String status;
                    boolean isShortage;
                    if (att.getOffsetType() != null && !"none".equals(att.getOffsetType())) {
                        status = offsetLabel(att.getOffsetType());
                        isShortage = false;
                    } else if (effectiveHours >= BusinessRules.STANDARD_WORK_HOURS) {
                        status = "正常";
                        isShortage = false;
                    } else if (effectiveHours > 0) {
                        status = "缺卡";
                        isShortage = true;
                    } else {
                        status = "旷工";
                        isShortage = true;
                    }
                    detail.put("type", "attendance");
                    detail.put("status", status);
                    detail.put("checkIn", att.getCheckIn() == null ? "" : att.getCheckIn());
                    detail.put("checkOut", att.getCheckOut() == null ? "" : att.getCheckOut());
                    detail.put("effectiveHours", effectiveHours);
                    detail.put("isShortage", isShortage);
                    detail.put("offsetType", att.getOffsetType());
                    detail.put("offsetUnits", att.getOffsetUnits());
                    detail.put("offsetLabel", offsetLabel(att.getOffsetType()));
                    detail.put("remark", att.getRemark() == null ? "" : att.getRemark());
                } else {
                    detail.put("type", "attendance");
                    detail.put("status", "旷工");
                    detail.put("checkIn", "");
                    detail.put("checkOut", "");
                    detail.put("effectiveHours", 0);
                    detail.put("isShortage", true);
                    detail.put("offsetType", "none");
                    detail.put("offsetUnits", 0);
                    detail.put("offsetLabel", "");
                    detail.put("remark", "");
                }
                dailyDetails.add(detail);
            }

            long workDays = dailyDetails.stream().filter(dd -> !"weekend".equals(dd.get("type"))).count();
            long normalDays = dailyDetails.stream().filter(dd -> "正常".equals(dd.get("status"))).count();
            long absentDays = dailyDetails.stream().filter(dd -> "旷工".equals(dd.get("status"))).count();
            long shortageDays = dailyDetails.stream().filter(dd -> Boolean.TRUE.equals(dd.get("isShortage")) && !"weekend".equals(dd.get("type")) && !"旷工".equals(dd.get("status"))).count();
            long leaveDays = dailyDetails.stream().filter(dd -> "leave".equals(dd.get("type"))).count();
            int overtimeCount = (int) userOvertime.stream().filter(o -> "approved".equals(o.getStatus())).count();

            LeaveBalance annual = userBalances.stream().filter(b -> "annual".equals(b.getLeaveType())).findFirst().orElse(null);
            LeaveBalance comp = userBalances.stream().filter(b -> "compensatory".equals(b.getLeaveType())).findFirst().orElse(null);
            Object annualRemaining = annual == null ? 0 : String.format("%.1f", annual.getEntitledDays().subtract(annual.getUsedDays()));
            Object compRemaining = comp == null ? 0 : String.format("%.1f", comp.getEntitledDays().subtract(comp.getUsedDays()));

            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("totalDays", daysInMonth);
            summary.put("workDays", workDays);
            summary.put("normalDays", normalDays);
            summary.put("shortageDays", shortageDays);
            summary.put("leaveDays", leaveDays);
            summary.put("absentDays", absentDays);
            summary.put("overtimeUnits", overtimeCount);
            summary.put("annualLeaveRemaining", annualRemaining);
            summary.put("compLeaveRemaining", compRemaining);

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("userId", user.getId());
            item.put("userName", user.getName());
            item.put("employeeId", user.getEmployeeId());
            item.put("teamName", teamName(user.getTeamId()));
            item.put("summary", summary);
            item.put("dailyDetails", dailyDetails);
            list.add(item);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("yearMonth", yearMonth);
        result.put("daysInMonth", daysInMonth);
        result.put("totalEmployees", users.size());
        result.put("list", list);
        return result;
    }

    private String leaveTypeName(String type) {
        if (type == null) return null;
        if ("annual".equals(type)) return "年假";
        if ("compensatory".equals(type)) return "调休";
        if ("mixed".equals(type)) return "混合抵扣（年假+调休）";
        if ("business_trip".equals(type)) return "公差";
        if ("other".equals(type)) return "其他";
        return type;
    }

    private String offsetLabel(String type) {
        if (type == null) return "";
        if ("annual_leave".equals(type)) return "年假抵扣";
        if ("compensatory_leave".equals(type)) return "调休抵扣";
        if ("no_fault".equals(type)) return "正常-无责任";
        return "";
    }

    private String teamName(Long teamId) {
        if (teamId == null) return null;
        Team t = teamMapper.selectById(teamId);
        return t == null ? null : t.getName();
    }
}
