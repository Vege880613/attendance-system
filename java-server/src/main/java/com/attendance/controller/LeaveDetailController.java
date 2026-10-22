package com.attendance.controller;

import com.attendance.common.BizException;
import com.attendance.common.UserContext;
import com.attendance.entity.AttendanceRequest;
import com.attendance.entity.OvertimeUnit;
import com.attendance.entity.Project;
import com.attendance.mapper.AttendanceRequestMapper;
import com.attendance.mapper.OvertimeUnitMapper;
import com.attendance.mapper.ProjectMapper;
import com.attendance.mapper.UserMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 假期/加班明细接口（/api/leave-detail）
 */
@RestController
@RequestMapping("/api/leave-detail")
public class LeaveDetailController {

    @Resource
    private AttendanceRequestMapper attendanceRequestMapper;
    @Resource
    private OvertimeUnitMapper overtimeUnitMapper;
    @Resource
    private ProjectMapper projectMapper;
    @Resource
    private UserMapper userMapper;

    @GetMapping("/detail/{userId}")
    public Map<String, Object> detail(@PathVariable Long userId,
                                      @RequestParam(required = false) Integer year,
                                      @RequestParam(required = false) String leaveType) {
        if ("employee".equals(UserContext.getRole()) && !userId.equals(UserContext.getUserId())) {
            throw BizException.forbidden("无权查看");
        }
        int targetYear = year == null ? LocalDate.now().getYear() : year;
        String type = (leaveType == null || leaveType.isEmpty() || "annual".equals(leaveType)) ? "annual" : leaveType;

        List<AttendanceRequest> requests = attendanceRequestMapper.selectList(new QueryWrapper<AttendanceRequest>()
                .eq("user_id", userId)
                .eq("leave_type_used", type)
                .eq("status", "entered")
                .apply("YEAR(start_date) = {0}", targetYear)
                .orderByDesc("start_date"));

        List<Map<String, Object>> list = requests.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId());
            m.put("type", r.getType());
            m.put("subtype", r.getSubtype());
            m.put("start_date", r.getStartDate());
            m.put("end_date", r.getEndDate());
            m.put("days", r.getDays());
            m.put("status", r.getStatus());
            m.put("reason", r.getReason());
            m.put("created_at", r.getCreatedAt());
            m.put("is_reset_before", r.getIsResetBefore());
            m.put("team_lead_comment", r.getTeamLeadComment());
            m.put("dept_manager_comment", r.getDeptManagerComment());
            m.put("manager_comment", r.getManagerComment());
            m.put("user_name", userName(r.getUserId()));
            m.put("leave_type", type);
            m.put("team_lead_name", userName(r.getTeamLeadId()));
            m.put("dept_manager_name", userName(r.getDeptManagerId()));
            m.put("manager_name", userName(r.getManagerId()));
            return m;
        }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("list", list);
        result.put("year", targetYear);
        return result;
    }

    @GetMapping("/overtime-detail/{userId}")
    public Map<String, Object> overtimeDetail(@PathVariable Long userId,
                                              @RequestParam(required = false) Integer year,
                                              @RequestParam(required = false) String yearMonth) {
        if ("employee".equals(UserContext.getRole()) && !userId.equals(UserContext.getUserId())) {
            throw BizException.forbidden("无权查看");
        }
        int targetYear = year == null ? LocalDate.now().getYear() : year;

        QueryWrapper<OvertimeUnit> qw = new QueryWrapper<OvertimeUnit>().eq("user_id", userId);
        if (yearMonth != null && !yearMonth.isEmpty()) {
            qw.apply("DATE_FORMAT(work_date, '%Y-%m') = {0}", yearMonth);
        } else {
            qw.apply("YEAR(work_date) = {0}", targetYear);
        }
        qw.orderByDesc("work_date");
        List<OvertimeUnit> units = overtimeUnitMapper.selectList(qw);

        List<Map<String, Object>> list = units.stream().map(o -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", o.getId());
            m.put("work_date", o.getWorkDate());
            m.put("hours", o.getHours());
            m.put("units_count", o.getUnitsCount());
            m.put("status", o.getStatus());
            m.put("leave_request_id", o.getLeaveRequestId());
            m.put("leave_type_mark", o.getLeaveTypeMark());
            m.put("leave_dates", o.getLeaveDates());
            m.put("user_name", userName(o.getUserId()));
            m.put("employee_id", employeeId(o.getUserId()));
            // 关联申请信息
            String reason = null, teamLeadComment = null;
            LocalDate leaveStart = null, leaveEnd = null;
            if (o.getRequestId() != null) {
                AttendanceRequest r = attendanceRequestMapper.selectById(o.getRequestId());
                if (r != null) {
                    reason = r.getReason();
                    teamLeadComment = r.getTeamLeadComment();
                    leaveStart = r.getStartDate();
                    leaveEnd = r.getEndDate();
                }
            }
            m.put("reason", reason);
            m.put("team_lead_comment", teamLeadComment);
            m.put("leave_start", leaveStart);
            m.put("leave_end", leaveEnd);
            String projectName = null;
            if (o.getRequestId() != null) {
                AttendanceRequest r = attendanceRequestMapper.selectById(o.getRequestId());
                if (r != null && r.getProjectId() != null) {
                    Project p = projectMapper.selectById(r.getProjectId());
                    projectName = p == null ? null : p.getName();
                }
            }
            m.put("project_name", projectName);
            return m;
        }).collect(Collectors.toList());

        // 汇总统计
        QueryWrapper<OvertimeUnit> sumQw = new QueryWrapper<OvertimeUnit>().eq("user_id", userId)
                .apply("YEAR(work_date) = {0}", targetYear);
        List<OvertimeUnit> all = overtimeUnitMapper.selectList(sumQw);
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("total_units", all.size());
        summary.put("available_units", all.stream().filter(o -> "approved".equals(o.getStatus())).count());
        summary.put("used_units", all.stream().filter(o -> "used".equals(o.getStatus())).count());
        summary.put("pending_units", all.stream().filter(o -> "pending".equals(o.getStatus())).count());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("list", list);
        result.put("summary", summary);
        result.put("year", targetYear);
        return result;
    }

    private String userName(Long userId) {
        if (userId == null) return null;
        com.attendance.entity.User u = userMapper.selectById(userId);
        return u == null ? null : u.getName();
    }

    private String employeeId(Long userId) {
        if (userId == null) return null;
        com.attendance.entity.User u = userMapper.selectById(userId);
        return u == null ? null : u.getEmployeeId();
    }
}
