package com.attendance.controller;

import com.attendance.common.BizException;
import com.attendance.common.UserContext;
import com.attendance.entity.AttendanceRecord;
import com.attendance.entity.AttendanceRequest;
import com.attendance.entity.LeaveBalance;
import com.attendance.entity.OvertimeUnit;
import com.attendance.mapper.AttendanceRecordMapper;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 考勤接口（/api/attendance）
 */
@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    @Resource
    private AttendanceRecordMapper attendanceRecordMapper;
    @Resource
    private AttendanceRequestMapper attendanceRequestMapper;
    @Resource
    private LeaveBalanceMapper leaveBalanceMapper;
    @Resource
    private OvertimeUnitMapper overtimeUnitMapper;
    @Resource
    private UserMapper userMapper;

    @GetMapping
    public Map<String, Object> list(@RequestParam(required = false) String yearMonth,
                                    @RequestParam(required = false) Long userId) {
        if (yearMonth == null || yearMonth.isEmpty()) {
            throw BizException.badRequest("请指定年月");
        }
        Long targetUserId = userId;
        if ("employee".equals(UserContext.getRole())) targetUserId = UserContext.getUserId();

        List<Map<String, Object>> list;
        if (targetUserId == null) {
            List<AttendanceRecord> records = attendanceRecordMapper.selectList(new QueryWrapper<AttendanceRecord>()
                    .apply("DATE_FORMAT(work_date, '%Y-%m') = {0}", yearMonth)
                    .orderByAsc("work_date"));
            list = records.stream().map(r -> {
                Map<String, Object> m = recordVo(r);
                m.put("team_id", teamIdOf(r.getUserId()));
                return m;
            }).collect(Collectors.toList());
        } else {
            List<AttendanceRecord> records = attendanceRecordMapper.selectList(new QueryWrapper<AttendanceRecord>()
                    .eq("user_id", targetUserId)
                    .apply("DATE_FORMAT(work_date, '%Y-%m') = {0}", yearMonth)
                    .orderByAsc("work_date"));
            list = records.stream().map(this::recordVo).collect(Collectors.toList());
        }

        List<Map<String, Object>> leaves = java.util.Arrays.asList();
        if (targetUserId != null) {
            List<AttendanceRequest> lr = attendanceRequestMapper.selectList(new QueryWrapper<AttendanceRequest>()
                    .eq("user_id", targetUserId).eq("status", "entered").eq("type", "leave")
                    .apply("DATE_FORMAT(start_date, '%Y-%m') <= {0} AND DATE_FORMAT(end_date, '%Y-%m') >= {0}", yearMonth));
            leaves = lr.stream().map(r -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", r.getId());
                m.put("user_id", r.getUserId());
                m.put("type", r.getType());
                m.put("start_date", r.getStartDate());
                m.put("end_date", r.getEndDate());
                m.put("days", r.getDays());
                m.put("leave_type_used", r.getLeaveTypeUsed());
                m.put("reason", r.getReason());
                m.put("status", r.getStatus());
                m.put("created_at", r.getCreatedAt());
                m.put("created_by", r.getCreatedBy());
                m.put("updated_at", r.getUpdatedAt());
                m.put("updated_by", r.getUpdatedBy());
                return m;
            }).collect(Collectors.toList());
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("list", list);
        result.put("leaves", leaves);
        return result;
    }

    @GetMapping("/export")
    @RequireRole("manager")
    public ResponseEntity<byte[]> export(@RequestParam String yearMonth) {
        List<AttendanceRecord> records = attendanceRecordMapper.selectList(new QueryWrapper<AttendanceRecord>()
                .apply("DATE_FORMAT(work_date, '%Y-%m') = {0}", yearMonth)
                .orderByAsc("work_date"));
        List<String> columns = java.util.Arrays.asList("user_id", "user_name", "team_id", "work_date", "check_in", "check_out", "effective_hours", "standard_hours", "is_shortage", "offset_type", "offset_units", "remark", "is_reset_before", "created_at", "created_by", "updated_at", "updated_by");
        List<Map<String, Object>> rows = records.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("user_id", r.getUserId());
            m.put("user_name", userName(r.getUserId()));
            m.put("team_id", teamIdOf(r.getUserId()));
            m.put("work_date", r.getWorkDate());
            m.put("check_in", r.getCheckIn());
            m.put("check_out", r.getCheckOut());
            m.put("effective_hours", r.getEffectiveHours());
            m.put("standard_hours", r.getStandardHours());
            m.put("is_shortage", r.getIsShortage());
            m.put("offset_type", r.getOffsetType());
            m.put("offset_units", r.getOffsetUnits());
            m.put("remark", r.getRemark());
            m.put("is_reset_before", r.getIsResetBefore());
            m.put("created_at", r.getCreatedAt());
            m.put("created_by", r.getCreatedBy());
            m.put("updated_at", r.getUpdatedAt());
            m.put("updated_by", r.getUpdatedBy());
            return m;
        }).collect(Collectors.toList());
        return CsvResponse.of("attendance_" + yearMonth + ".csv", CsvUtil.render(columns, rows));
    }

    @PostMapping("/batch")
    @RequireRole("manager")
    public Map<String, Object> batchCreate(@RequestBody Map<String, Object> body) {
        String yearMonth = str(body.get("yearMonth"));
        List<Map<String, Object>> records = body.get("records") == null ? java.util.Arrays.asList()
                : (List<Map<String, Object>>) body.get("records");
        if (yearMonth.isEmpty() || body.get("records") == null) {
            throw BizException.badRequest("参数不合法");
        }
        String createdBy = str(UserContext.getUserId());
        for (Map<String, Object> r : records) {
            Long userId = Long.valueOf(str(r.get("user_id")));
            int day = Integer.parseInt(str(r.get("day")));
            LocalDate workDate = LocalDate.parse(yearMonth + "-" + String.format("%02d", day));
            String checkIn = str(r.get("check_in"));
            String checkOut = str(r.get("check_out"));
            double effective = BusinessRules.calcEffectiveHours(checkIn, checkOut);
            int shortage = BusinessRules.isShortage(effective) ? 1 : 0;
            AttendanceRecord rec = new AttendanceRecord();
            rec.setUserId(userId);
            rec.setWorkDate(workDate);
            rec.setCheckIn(checkIn.isEmpty() ? null : checkIn);
            rec.setCheckOut(checkOut.isEmpty() ? null : checkOut);
            rec.setEffectiveHours(BigDecimal.valueOf(effective));
            rec.setIsShortage(shortage);
            rec.setRemark(str(r.get("remark")));
            rec.setCreatedBy(createdBy);
            attendanceRecordMapper.upsert(rec);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "成功录入 " + records.size() + " 条考勤记录");
        return result;
    }

    @PutMapping("/offset")
    @RequireRole("manager")
    public Map<String, Object> offset(@RequestBody Map<String, Object> body) {
        Long userId = body.get("userId") == null ? null : Long.valueOf(str(body.get("userId")));
        String date = str(body.get("date"));
        String offsetType = str(body.get("offsetType"));
        double offsetUnits = body.get("offsetUnits") == null ? 0 : Double.parseDouble(str(body.get("offsetUnits")));
        List<Object> overtimeUnitIds = body.get("overtimeUnitIds") == null ? java.util.Arrays.asList()
                : (List<Object>) body.get("overtimeUnitIds");

        if (userId == null || date.isEmpty()) {
            throw BizException.badRequest("缺少用户ID或日期");
        }
        LocalDate workDate = LocalDate.parse(date);
        int year = workDate.getYear();

        // 该日期已有请假记录则不允许抵扣
        Long leaveCount = attendanceRequestMapper.selectCount(new QueryWrapper<AttendanceRequest>()
                .eq("user_id", userId).eq("type", "leave").eq("status", "entered")
                .apply("{0} BETWEEN start_date AND end_date", date));
        if (leaveCount != null && leaveCount > 0) {
            throw BizException.badRequest("该日期已请假，无法抵扣");
        }

        AttendanceRecord record = attendanceRecordMapper.selectOne(new QueryWrapper<AttendanceRecord>()
                .eq("user_id", userId).eq("work_date", workDate));
        Long recordId = record == null ? null : record.getId();

        if ("annual_leave".equals(offsetType)) {
            if (offsetUnits <= 0) throw BizException.badRequest("抵扣天数必须大于 0");
            LeaveBalance bal = leaveBalanceMapper.selectOne(new QueryWrapper<LeaveBalance>()
                    .eq("user_id", userId).eq("leave_type", "annual").eq("year", year));
            double remaining = bal == null ? 0 : bal.getEntitledDays().subtract(bal.getUsedDays()).doubleValue();
            if (remaining < offsetUnits) throw BizException.badRequest("年假余额不足");
            bal.setUsedDays(bal.getUsedDays().add(BigDecimal.valueOf(offsetUnits)));
            leaveBalanceMapper.updateById(bal);
            upsertOffsetRecord(recordId, userId, workDate, "annual_leave", offsetUnits);
            insertOffsetLeaveRequest(userId, date, "annual", offsetUnits);
        } else if ("compensatory_leave".equals(offsetType)) {
            if (overtimeUnitIds.isEmpty()) throw BizException.badRequest("调休抵扣需要选择加班条目");
            List<OvertimeUnit> units = overtimeUnitMapper.selectList(new QueryWrapper<OvertimeUnit>()
                    .eq("user_id", userId).eq("status", "approved")
                    .in("id", overtimeUnitIds.stream().map(o -> Long.valueOf(str(o))).collect(Collectors.toList())));
            if (units.size() != overtimeUnitIds.size()) throw BizException.badRequest("选择的加班条目不可用");
            int totalUnits = units.stream().mapToInt(OvertimeUnit::getUnitsCount).sum();
            double totalDays = Math.floor(totalUnits / 3.0) + (totalUnits % 3 > 0 ? 0.5 : 0);
            if (Math.abs(totalDays - offsetUnits) > 0.01) {
                throw BizException.badRequest("选择的加班条目累计可抵扣 " + totalDays + " 天，与需要抵扣的 " + offsetUnits + " 天不匹配");
            }
            Long approvedCount = overtimeUnitMapper.selectCount(new QueryWrapper<OvertimeUnit>()
                    .eq("user_id", userId).eq("status", "approved"));
            long entitledUnits = approvedCount == null ? 0 : approvedCount;
            double entitledDays = Math.floor(entitledUnits / 3.0) + (entitledUnits % 3 > 0 ? 0.5 : 0);
            LeaveBalance compBal = leaveBalanceMapper.selectOne(new QueryWrapper<LeaveBalance>()
                    .eq("user_id", userId).eq("leave_type", "compensatory").eq("year", year));
            double compUsed = compBal == null ? 0 : compBal.getUsedDays().doubleValue();
            if ((entitledDays - compUsed) < totalDays) {
                throw BizException.badRequest("调休余额不足（剩余 " + String.format("%.1f", entitledDays - compUsed) + " 天，需要 " + totalDays + " 天）");
            }
            for (OvertimeUnit u : units) {
                overtimeUnitMapper.update(null, new UpdateWrapper<OvertimeUnit>()
                        .set("status", "used").set("leave_type_mark", "compensatory").eq("id", u.getId()));
            }
            if (compBal != null) {
                compBal.setUsedDays(compBal.getUsedDays().add(BigDecimal.valueOf(totalDays)));
                leaveBalanceMapper.updateById(compBal);
            }
            upsertOffsetRecord(recordId, userId, workDate, "compensatory_leave", totalDays);
            insertOffsetLeaveRequest(userId, date, "compensatory", totalDays);
        } else {
            throw BizException.badRequest("抵扣类型不合法");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "抵扣成功");
        return result;
    }

    private void upsertOffsetRecord(Long recordId, Long userId, LocalDate date, String offsetType, double units) {
        if (recordId != null) {
            attendanceRecordMapper.update(null, new UpdateWrapper<AttendanceRecord>()
                    .set("offset_type", offsetType).set("offset_units", units).set("is_shortage", 0)
                    .set("updated_by", str(UserContext.getUserId())).eq("id", recordId));
        } else {
            AttendanceRecord rec = new AttendanceRecord();
            rec.setUserId(userId);
            rec.setWorkDate(date);
            rec.setEffectiveHours(BigDecimal.ZERO);
            rec.setIsShortage(0);
            rec.setOffsetType(offsetType);
            rec.setOffsetUnits(BigDecimal.valueOf(units));
            rec.setCreatedBy(str(UserContext.getUserId()));
            attendanceRecordMapper.insert(rec);
        }
    }

    private void insertOffsetLeaveRequest(Long userId, String date, String leaveType, double days) {
        AttendanceRequest r = new AttendanceRequest();
        r.setUserId(userId);
        r.setType("leave");
        r.setLeaveTypeUsed(leaveType);
        r.setStartDate(LocalDate.parse(date));
        r.setEndDate(LocalDate.parse(date));
        r.setDays(BigDecimal.valueOf(days));
        r.setStatus("entered");
        r.setReason("考勤抵扣");
        r.setManagerId(UserContext.getUserId());
        r.setManagerComment("管理员抵扣");
        r.setManagerTime(LocalDateTime.now());
        r.setCreatedBy(str(UserContext.getUserId()));
        attendanceRequestMapper.insert(r);
    }

    private Map<String, Object> recordVo(AttendanceRecord r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("user_id", r.getUserId());
        m.put("work_date", r.getWorkDate());
        m.put("check_in", r.getCheckIn());
        m.put("check_out", r.getCheckOut());
        m.put("effective_hours", r.getEffectiveHours());
        m.put("standard_hours", r.getStandardHours());
        m.put("is_shortage", r.getIsShortage());
        m.put("offset_type", r.getOffsetType());
        m.put("offset_units", r.getOffsetUnits());
        m.put("is_reset_before", r.getIsResetBefore());
        m.put("remark", r.getRemark());
        m.put("created_at", r.getCreatedAt());
        m.put("created_by", r.getCreatedBy());
        m.put("updated_at", r.getUpdatedAt());
        m.put("updated_by", r.getUpdatedBy());
        m.put("approved_at", r.getApprovedAt());
        m.put("approved_by", r.getApprovedBy());
        m.put("rejected_at", r.getRejectedAt());
        m.put("rejected_by", r.getRejectedBy());
        m.put("user_name", userName(r.getUserId()));
        return m;
    }

    private String userName(Long userId) {
        com.attendance.entity.User u = userMapper.selectById(userId);
        return u == null ? null : u.getName();
    }

    private Long teamIdOf(Long userId) {
        com.attendance.entity.User u = userMapper.selectById(userId);
        return u == null ? null : u.getTeamId();
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }
}
