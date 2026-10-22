package com.attendance.controller;

import com.attendance.common.UserContext;
import com.attendance.entity.OvertimeUnit;
import com.attendance.entity.User;
import com.attendance.mapper.OvertimeUnitMapper;
import com.attendance.mapper.UserMapper;
import com.attendance.security.RequireRole;
import com.attendance.util.CsvResponse;
import com.attendance.util.CsvUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 加班接口（/api/overtime）
 */
@RestController
@RequestMapping("/api/overtime")
public class OvertimeController {

    @Resource
    private OvertimeUnitMapper overtimeUnitMapper;
    @Resource
    private UserMapper userMapper;

    @GetMapping
    public Map<String, Object> list(@RequestParam(required = false) Long userId,
                                    @RequestParam(required = false) String status) {
        QueryWrapper<OvertimeUnit> qw = new QueryWrapper<>();
        if (userId != null) qw.eq("user_id", userId);
        if (status != null && !status.isEmpty()) qw.eq("status", status);
        if ("employee".equals(UserContext.getRole())) qw.eq("user_id", UserContext.getUserId());
        qw.orderByDesc("work_date");
        List<OvertimeUnit> units = overtimeUnitMapper.selectList(qw);
        List<Map<String, Object>> list = units.stream().map(this::toVo).collect(Collectors.toList());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("list", list);
        return result;
    }

    @GetMapping("/export")
    @RequireRole("manager")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) Long userId,
                                         @RequestParam(required = false) String status) {
        QueryWrapper<OvertimeUnit> qw = new QueryWrapper<>();
        if (userId != null) qw.eq("user_id", userId);
        if (status != null && !status.isEmpty()) qw.eq("status", status);
        qw.orderByDesc("work_date");
        List<OvertimeUnit> units = overtimeUnitMapper.selectList(qw);
        List<String> columns = java.util.Arrays.asList("id", "user_name", "work_date", "hours", "units_count", "status", "created_at", "created_by", "updated_at", "updated_by", "approved_at", "approved_by", "rejected_at", "rejected_by");
        List<Map<String, Object>> rows = units.stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("user_name", userName(u.getUserId()));
            m.put("work_date", u.getWorkDate());
            m.put("hours", u.getHours());
            m.put("units_count", u.getUnitsCount());
            m.put("status", u.getStatus());
            m.put("created_at", u.getCreatedAt());
            m.put("created_by", u.getCreatedBy());
            m.put("updated_at", u.getUpdatedAt());
            m.put("updated_by", u.getUpdatedBy());
            m.put("approved_at", u.getApprovedAt());
            m.put("approved_by", u.getApprovedBy());
            m.put("rejected_at", u.getRejectedAt());
            m.put("rejected_by", u.getRejectedBy());
            return m;
        }).collect(Collectors.toList());
        return CsvResponse.of("overtime_export.csv", CsvUtil.render(columns, rows));
    }

    @GetMapping("/available/{userId}")
    public Map<String, Object> available(@PathVariable Long userId) {
        List<OvertimeUnit> units = overtimeUnitMapper.selectList(
                new QueryWrapper<OvertimeUnit>().eq("user_id", userId).eq("status", "approved").orderByAsc("work_date"));
        List<Map<String, Object>> list = units.stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("user_id", u.getUserId());
            m.put("work_date", u.getWorkDate());
            m.put("hours", u.getHours());
            m.put("units_count", u.getUnitsCount());
            m.put("status", u.getStatus());
            return m;
        }).collect(Collectors.toList());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("list", list);
        result.put("total", list.size());
        return result;
    }

    private Map<String, Object> toVo(OvertimeUnit u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("user_id", u.getUserId());
        m.put("work_date", u.getWorkDate());
        m.put("hours", u.getHours());
        m.put("units_count", u.getUnitsCount());
        m.put("status", u.getStatus());
        m.put("request_id", u.getRequestId());
        m.put("leave_request_id", u.getLeaveRequestId());
        m.put("leave_type_mark", u.getLeaveTypeMark());
        m.put("leave_dates", u.getLeaveDates());
        m.put("created_at", u.getCreatedAt());
        m.put("created_by", u.getCreatedBy());
        m.put("updated_at", u.getUpdatedAt());
        m.put("updated_by", u.getUpdatedBy());
        m.put("approved_at", u.getApprovedAt());
        m.put("approved_by", u.getApprovedBy());
        m.put("rejected_at", u.getRejectedAt());
        m.put("rejected_by", u.getRejectedBy());
        m.put("user_name", userName(u.getUserId()));
        m.put("employee_id", employeeId(u.getUserId()));
        return m;
    }

    private String userName(Long userId) {
        User u = userMapper.selectById(userId);
        return u == null ? null : u.getName();
    }

    private String employeeId(Long userId) {
        User u = userMapper.selectById(userId);
        return u == null ? null : u.getEmployeeId();
    }
}
