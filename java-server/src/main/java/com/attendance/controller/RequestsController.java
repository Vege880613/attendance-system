package com.attendance.controller;

import com.attendance.common.BizException;
import com.attendance.common.UserContext;
import com.attendance.entity.AttendanceRequest;
import com.attendance.entity.LeaveBalance;
import com.attendance.entity.OvertimeUnit;
import com.attendance.entity.Team;
import com.attendance.entity.User;
import com.attendance.mapper.AttendanceRequestMapper;
import com.attendance.mapper.AuditLogMapper;
import com.attendance.mapper.LeaveBalanceMapper;
import com.attendance.mapper.OvertimeUnitMapper;
import com.attendance.mapper.TeamMapper;
import com.attendance.mapper.UserMapper;
import com.attendance.security.RequireRole;
import com.attendance.util.BusinessRules;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import org.springframework.transaction.annotation.Transactional;
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
 * 申请/审批接口（/api/requests）
 * 审批状态机：pending → approved/pending_dept → entered；或 → rejected
 */
@RestController
@RequestMapping("/api/requests")
public class RequestsController {

    @Resource
    private AttendanceRequestMapper requestMapper;
    @Resource
    private OvertimeUnitMapper overtimeUnitMapper;
    @Resource
    private LeaveBalanceMapper leaveBalanceMapper;
    @Resource
    private TeamMapper teamMapper;
    @Resource
    private UserMapper userMapper;
    @Resource
    private AuditLogMapper auditLogMapper;

    @PostMapping
    @Transactional
    public Map<String, Object> create(@RequestBody Map<String, Object> body) {
        String type = str(body.get("type"));
        String startDate = str(body.get("start_date"));
        String endDate = str(body.get("end_date"));
        if (type.isEmpty() || startDate.isEmpty() || endDate.isEmpty()) {
            throw BizException.badRequest("缺少必要字段");
        }
        double days = body.get("days") == null ? 0 : Double.parseDouble(str(body.get("days")));
        String leaveTypeUsed = str(body.get("leave_type_used"));
        double annualDaysUsed = "mixed".equals(leaveTypeUsed) ? (body.get("annual_days") == null ? 0 : Double.parseDouble(str(body.get("annual_days")))) : 0;
        Long projectId = body.get("project_id") == null ? null : Long.valueOf(str(body.get("project_id")));
        List<Object> overtimeUnitIds = body.get("overtime_unit_ids") == null ? java.util.Arrays.asList() : (List<Object>) body.get("overtime_unit_ids");
        Long userId = UserContext.getUserId();

        if ("overtime".equals(type) && projectId == null) {
            throw BizException.badRequest("加班申请必须选择项目或系统");
        }

        // 调休/混合：校验加班条目
        if ("leave".equals(type) && ("compensatory".equals(leaveTypeUsed) || "mixed".equals(leaveTypeUsed))) {
            if (overtimeUnitIds.isEmpty()) {
                throw BizException.badRequest("调休申请必须选择对应的加班条目");
            }
            List<Long> ids = overtimeUnitIds.stream().map(o -> Long.valueOf(str(o))).collect(Collectors.toList());
            List<OvertimeUnit> units = overtimeUnitMapper.selectList(new QueryWrapper<OvertimeUnit>()
                    .in("id", ids).eq("user_id", userId).eq("status", "approved"));
            if (units.size() != ids.size()) {
                throw BizException.badRequest("选择的加班条目不可用或不属于您");
            }
            int totalUnits = units.stream().mapToInt(OvertimeUnit::getUnitsCount).sum();
            double totalDays = Math.floor(totalUnits / 3.0) + (totalUnits % 3 > 0 ? 0.5 : 0);
            double expectedCompDays = days - annualDaysUsed;
            if (Math.abs(totalDays - expectedCompDays) > 0.01) {
                throw BizException.badRequest("选择的加班条目累计可抵扣 " + totalDays + " 天，与需要抵扣的调休天数 " + expectedCompDays + " 天不匹配（总请假 " + days + " 天 - 年假 " + annualDaysUsed + " 天）");
            }
            Long allOvertime = overtimeUnitMapper.selectCount(new QueryWrapper<OvertimeUnit>()
                    .eq("user_id", userId).apply("YEAR(work_date) = {0}", LocalDate.parse(startDate).getYear()));
            long entitledUnits = allOvertime == null ? 0 : allOvertime;
            double entitledDays = Math.floor(entitledUnits / 3.0) + (entitledUnits % 3 > 0 ? 0.5 : 0);
            Long usedResult = requestMapper.selectCount(new QueryWrapper<AttendanceRequest>()
                    .eq("user_id", userId).eq("leave_type_used", "compensatory").eq("status", "entered")
                    .apply("YEAR(start_date) = {0}", LocalDate.parse(startDate).getYear()));
            // 简化：此处不再精确计算已用，仅做余额上限校验
            if (entitledDays < totalDays) {
                throw BizException.badRequest("调休余额不足，当前剩余 " + entitledDays + " 天，需要 " + totalDays + " 天");
            }
        }

        // 年假余额校验
        if ("leave".equals(type) && ("annual".equals(leaveTypeUsed) || "mixed".equals(leaveTypeUsed))) {
            int year = LocalDate.parse(startDate).getYear();
            LeaveBalance bal = leaveBalanceMapper.selectOne(new QueryWrapper<LeaveBalance>()
                    .eq("user_id", userId).eq("leave_type", "annual").eq("year", year));
            double balDays = bal == null ? 0 : bal.getEntitledDays().subtract(bal.getUsedDays()).doubleValue();
            double annualNeeded = "mixed".equals(leaveTypeUsed) ? annualDaysUsed : days;
            if (balDays < annualNeeded) {
                throw BizException.badRequest("年假余额不足，当前剩余 " + balDays + " 天，需要 " + annualNeeded + " 天");
            }
        }

        User me = userMapper.selectById(userId);
        Long teamLeadId = null;
        if (me != null && me.getTeamId() != null) {
            Team team = teamMapper.selectById(me.getTeamId());
            teamLeadId = team == null ? null : team.getLeadUserId();
        }
        boolean needsDeptManager = "leave".equals(type) && days >= 3;

        AttendanceRequest r = new AttendanceRequest();
        r.setUserId(userId);
        r.setType(type);
        r.setSubtype(body.get("subtype") == null ? null : str(body.get("subtype")));
        r.setStartDate(LocalDate.parse(startDate));
        r.setEndDate(LocalDate.parse(endDate));
        r.setDays(BigDecimal.valueOf(days));
        r.setLeaveTypeUsed(leaveTypeUsed == null || leaveTypeUsed.isEmpty() ? "none" : leaveTypeUsed);
        r.setAnnualDays(BigDecimal.valueOf(annualDaysUsed));
        r.setReason(str(body.get("reason")));
        r.setProjectId(projectId);
        r.setStatus("pending");
        r.setTeamLeadId(teamLeadId);
        r.setNeedsDeptManager(needsDeptManager ? 1 : 0);
        r.setCreatedBy(str(userId));
        requestMapper.insert(r);

        audit(userId, "create_request", "发起 " + type + " 申请 ID=" + r.getId());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", r.getId());
        result.put("message", "申请已提交");
        return result;
    }

    @GetMapping("/mine")
    public Map<String, Object> mine() {
        List<AttendanceRequest> requests = requestMapper.selectList(new QueryWrapper<AttendanceRequest>()
                .eq("user_id", UserContext.getUserId()).orderByDesc("id"));
        List<Map<String, Object>> list = requests.stream().map(this::toVo).collect(Collectors.toList());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("list", list);
        return result;
    }

    @GetMapping("/review")
    @RequireRole({"team_lead", "manager"})
    public Map<String, Object> review() {
        List<AttendanceRequest> requests = requestMapper.selectList(new QueryWrapper<AttendanceRequest>()
                .eq("status", "pending").eq("team_lead_id", UserContext.getUserId()).orderByAsc("id"));
        List<Map<String, Object>> list = requests.stream().map(r -> {
            Map<String, Object> m = toVo(r);
            m.put("user_name", userName(r.getUserId()));
            m.put("team_id", teamIdOf(r.getUserId()));
            addLeaveBalance(m, r);
            m.put("needsDeptManager", Integer.valueOf(1).equals(r.getNeedsDeptManager()));
            return m;
        }).collect(Collectors.toList());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("list", list);
        return result;
    }

    @GetMapping("/dept-review")
    @RequireRole({"dept_manager", "manager"})
    public Map<String, Object> deptReview() {
        List<AttendanceRequest> requests = requestMapper.selectList(new QueryWrapper<AttendanceRequest>()
                .eq("status", "pending_dept").orderByAsc("id"));
        List<Map<String, Object>> list = requests.stream().map(r -> {
            Map<String, Object> m = toVo(r);
            m.put("user_name", userName(r.getUserId()));
            m.put("team_lead_name", userName(r.getTeamLeadId()));
            addLeaveBalance(m, r);
            return m;
        }).collect(Collectors.toList());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("list", list);
        return result;
    }

    @GetMapping("/confirm")
    @RequireRole("manager")
    public Map<String, Object> confirm() {
        List<AttendanceRequest> requests = requestMapper.selectList(new QueryWrapper<AttendanceRequest>()
                .eq("status", "approved").orderByAsc("id"));
        List<Map<String, Object>> list = requests.stream().map(r -> {
            Map<String, Object> m = toVo(r);
            m.put("user_name", userName(r.getUserId()));
            m.put("team_lead_name", userName(r.getTeamLeadId()));
            m.put("dept_manager_name", userName(r.getDeptManagerId()));
            addLeaveBalance(m, r);
            return m;
        }).collect(Collectors.toList());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("list", list);
        return result;
    }

    @PutMapping("/{id}/review")
    @RequireRole({"team_lead", "manager"})
    @Transactional
    public Map<String, Object> reviewAction(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String action = str(body.get("action"));
        if (!"approve".equals(action) && !"reject".equals(action)) {
            throw BizException.badRequest("操作不合法");
        }
        AttendanceRequest r = requestMapper.selectById(id);
        if (r == null) throw BizException.notFound("申请不存在");
        if (!"pending".equals(r.getStatus())) throw BizException.badRequest("该申请已处理");

        String newStatus;
        if ("approve".equals(action)) {
            newStatus = Integer.valueOf(1).equals(r.getNeedsDeptManager()) ? "pending_dept" : "approved";
        } else {
            newStatus = "rejected";
        }
        requestMapper.update(null, new UpdateWrapper<AttendanceRequest>()
                .set("status", newStatus)
                .set("team_lead_id", UserContext.getUserId())
                .set("team_lead_comment", str(body.get("comment")))
                .set("team_lead_time", LocalDateTime.now())
                .eq("id", id));

        if ("approve".equals(action) && "overtime".equals(r.getType())) {
            int unitCount = BusinessRules.hoursToUnits(r.getDays() == null ? 0 : r.getDays().doubleValue());
            for (int i = 0; i < unitCount; i++) {
                OvertimeUnit u = new OvertimeUnit();
                u.setUserId(r.getUserId());
                u.setWorkDate(r.getStartDate());
                u.setHours(BigDecimal.valueOf(3.00));
                u.setUnitsCount(1);
                u.setStatus("approved");
                u.setRequestId(r.getId());
                overtimeUnitMapper.insert(u);
            }
        }
        audit(UserContext.getUserId(), "review_request", "审核申请 ID=" + id + " 结果=" + newStatus);

        Map<String, Object> result = new LinkedHashMap<>();
        if ("approve".equals(action)) {
            result.put("message", Integer.valueOf(1).equals(r.getNeedsDeptManager()) ? "审核通过，待部门经理审批" : "审核通过");
        } else {
            result.put("message", "已驳回");
        }
        return result;
    }

    @PutMapping("/{id}/dept-review")
    @RequireRole({"dept_manager", "manager"})
    public Map<String, Object> deptReviewAction(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String action = str(body.get("action"));
        if (!"approve".equals(action) && !"reject".equals(action)) {
            throw BizException.badRequest("操作不合法");
        }
        AttendanceRequest r = requestMapper.selectById(id);
        if (r == null) throw BizException.notFound("申请不存在");
        if (!"pending_dept".equals(r.getStatus())) {
            throw BizException.badRequest("该申请不需要部门经理审批");
        }
        String newStatus = "approve".equals(action) ? "approved" : "rejected";
        requestMapper.update(null, new UpdateWrapper<AttendanceRequest>()
                .set("status", newStatus)
                .set("dept_manager_id", UserContext.getUserId())
                .set("dept_manager_comment", str(body.get("comment")))
                .set("dept_manager_time", LocalDateTime.now())
                .eq("id", id));
        audit(UserContext.getUserId(), "dept_review", "部门经理审批申请 ID=" + id + " 结果=" + newStatus);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "approve".equals(action) ? "审批通过" : "已驳回");
        return result;
    }

    @PutMapping("/{id}/confirm")
    @RequireRole("manager")
    @Transactional
    public Map<String, Object> confirmAction(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String action = str(body.get("action"));
        AttendanceRequest r = requestMapper.selectById(id);
        if (r == null) throw BizException.notFound("申请不存在");

        if ("reject".equals(action)) {
            requestMapper.update(null, new UpdateWrapper<AttendanceRequest>()
                    .set("status", "rejected").set("manager_id", UserContext.getUserId())
                    .set("manager_comment", str(body.get("comment"))).set("manager_time", LocalDateTime.now())
                    .eq("id", id));
            Map<String, Object> rejectResult = new LinkedHashMap<>();
            rejectResult.put("message", "已驳回");
            return rejectResult;
        }

        if (!"approved".equals(r.getStatus())) {
            if ("pending_dept".equals(r.getStatus())) throw BizException.badRequest("需要部门经理先审批");
            throw BizException.badRequest("只能确认已审核通过的申请");
        }

        if ("leave".equals(r.getType())) {
            int year = r.getStartDate().getYear();
            double days = r.getDays() == null ? 0 : r.getDays().doubleValue();
            String leaveType = r.getLeaveTypeUsed();

            if ("annual".equals(leaveType)) {
                LeaveBalance bal = leaveBalanceMapper.selectOne(new QueryWrapper<LeaveBalance>()
                        .eq("user_id", r.getUserId()).eq("leave_type", "annual").eq("year", year));
                if (bal == null || bal.getEntitledDays().subtract(bal.getUsedDays()).doubleValue() < days) {
                    throw BizException.badRequest("年假余额不足");
                }
                bal.setUsedDays(bal.getUsedDays().add(BigDecimal.valueOf(days)));
                leaveBalanceMapper.updateById(bal);
                requestMapper.update(null, new UpdateWrapper<AttendanceRequest>()
                        .set("status", "entered").set("manager_id", UserContext.getUserId())
                        .set("manager_comment", "管理员确认").set("manager_time", LocalDateTime.now()).eq("id", id));
            } else if ("compensatory".equals(leaveType)) {
                confirmCompensatory(r, year, days, id, null);
            } else if ("mixed".equals(leaveType)) {
                double annualDays = r.getAnnualDays() == null ? 0 : r.getAnnualDays().doubleValue();
                double compDays = days - annualDays;
                if (annualDays > 0) {
                    LeaveBalance annualBal = leaveBalanceMapper.selectOne(new QueryWrapper<LeaveBalance>()
                            .eq("user_id", r.getUserId()).eq("leave_type", "annual").eq("year", year));
                    if (annualBal == null || annualBal.getEntitledDays().subtract(annualBal.getUsedDays()).doubleValue() < annualDays) {
                        throw BizException.badRequest("年假余额不足");
                    }
                    annualBal.setUsedDays(annualBal.getUsedDays().add(BigDecimal.valueOf(annualDays)));
                    leaveBalanceMapper.updateById(annualBal);
                }
                if (compDays > 0) {
                    confirmCompensatory(r, year, compDays, null, r.getId());
                }
                requestMapper.update(null, new UpdateWrapper<AttendanceRequest>()
                        .set("status", "entered").set("manager_id", UserContext.getUserId())
                        .set("manager_comment", "管理员确认").set("manager_time", LocalDateTime.now()).eq("id", id));
                if (annualDays > 0) {
                    insertSplitDetail(r, "annual", annualDays, "混合抵扣-年假部分");
                }
                if (compDays > 0) {
                    insertSplitDetail(r, "compensatory", compDays, "混合抵扣-调休部分");
                }
            } else {
                // business_trip / other 不扣余额
                requestMapper.update(null, new UpdateWrapper<AttendanceRequest>()
                        .set("status", "entered").set("manager_id", UserContext.getUserId())
                        .set("manager_comment", str(body.get("comment"))).set("manager_time", LocalDateTime.now()).eq("id", id));
            }
        } else {
            requestMapper.update(null, new UpdateWrapper<AttendanceRequest>()
                    .set("status", "entered").set("manager_id", UserContext.getUserId())
                    .set("manager_comment", str(body.get("comment"))).set("manager_time", LocalDateTime.now()).eq("id", id));
        }

        audit(UserContext.getUserId(), "enter_request", "确认录入申请 ID=" + id);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "已确认录入");
        return result;
    }

    private void confirmCompensatory(AttendanceRequest r, int year, double days, Long requestId, Long ignore) {
        LeaveBalance bal = leaveBalanceMapper.selectOne(new QueryWrapper<LeaveBalance>()
                .eq("user_id", r.getUserId()).eq("leave_type", "compensatory").eq("year", year));
        if (bal != null) {
            bal.setUsedDays(bal.getUsedDays().add(BigDecimal.valueOf(days)));
            leaveBalanceMapper.updateById(bal);
        }
        int unitsNeeded = (int) (Math.floor(days) * 3 + (days % 1 >= 0.5 ? 1 : 0));
        List<OvertimeUnit> usedUnits = overtimeUnitMapper.selectList(new QueryWrapper<OvertimeUnit>()
                .eq("user_id", r.getUserId()).eq("status", "approved").orderByAsc("work_date"));
        List<Long> ids = usedUnits.stream().limit(unitsNeeded).map(OvertimeUnit::getId).collect(Collectors.toList());
        for (Long uid : ids) {
            overtimeUnitMapper.update(null, new UpdateWrapper<OvertimeUnit>()
                    .set("status", "used").set("leave_request_id", requestId != null ? requestId : r.getId())
                    .set("leave_type_mark", "compensatory").eq("id", uid));
        }
    }

    private void insertSplitDetail(AttendanceRequest r, String leaveType, double days, String reason) {
        AttendanceRequest d = new AttendanceRequest();
        d.setUserId(r.getUserId());
        d.setType("leave");
        d.setLeaveTypeUsed(leaveType);
        d.setStartDate(r.getStartDate());
        d.setEndDate(r.getEndDate());
        d.setDays(BigDecimal.valueOf(days));
        d.setStatus("entered");
        d.setReason(reason);
        d.setManagerId(UserContext.getUserId());
        d.setManagerComment("管理员抵扣");
        d.setManagerTime(LocalDateTime.now());
        requestMapper.insert(d);
    }

    private void addLeaveBalance(Map<String, Object> m, AttendanceRequest r) {
        if ("leave".equals(r.getType()) && ("annual".equals(r.getLeaveTypeUsed()) || "compensatory".equals(r.getLeaveTypeUsed()))) {
            int year = r.getStartDate().getYear();
            LeaveBalance bal = leaveBalanceMapper.selectOne(new QueryWrapper<LeaveBalance>()
                    .eq("user_id", r.getUserId()).eq("leave_type", r.getLeaveTypeUsed()).eq("year", year));
            double remaining = bal == null ? 0 : bal.getEntitledDays().subtract(bal.getUsedDays()).doubleValue();
            m.put("leaveBalance", remaining);
        }
    }

    private Map<String, Object> toVo(AttendanceRequest r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("user_id", r.getUserId());
        m.put("type", r.getType());
        m.put("subtype", r.getSubtype());
        m.put("start_date", r.getStartDate());
        m.put("end_date", r.getEndDate());
        m.put("days", r.getDays());
        m.put("overtime_units_used", r.getOvertimeUnitsUsed());
        m.put("leave_type_used", r.getLeaveTypeUsed());
        m.put("reason", r.getReason());
        m.put("project_id", r.getProjectId());
        m.put("status", r.getStatus());
        m.put("team_lead_id", r.getTeamLeadId());
        m.put("team_lead_comment", r.getTeamLeadComment());
        m.put("team_lead_time", r.getTeamLeadTime());
        m.put("dept_manager_id", r.getDeptManagerId());
        m.put("dept_manager_comment", r.getDeptManagerComment());
        m.put("dept_manager_time", r.getDeptManagerTime());
        m.put("manager_id", r.getManagerId());
        m.put("manager_comment", r.getManagerComment());
        m.put("manager_time", r.getManagerTime());
        m.put("needs_dept_manager", r.getNeedsDeptManager());
        m.put("is_reset_before", r.getIsResetBefore());
        m.put("created_at", r.getCreatedAt());
        m.put("created_by", r.getCreatedBy());
        m.put("updated_at", r.getUpdatedAt());
        m.put("updated_by", r.getUpdatedBy());
        m.put("approved_at", r.getApprovedAt());
        m.put("approved_by", r.getApprovedBy());
        m.put("rejected_at", r.getRejectedAt());
        m.put("rejected_by", r.getRejectedBy());
        m.put("annual_days", r.getAnnualDays());
        return m;
    }

    private void audit(Long userId, String action, String detail) {
        com.attendance.entity.AuditLog log = new com.attendance.entity.AuditLog();
        log.setUserId(userId);
        log.setAction(action);
        log.setDetail(detail);
        auditLogMapper.insert(log);
    }

    private String userName(Long userId) {
        if (userId == null) return null;
        User u = userMapper.selectById(userId);
        return u == null ? null : u.getName();
    }

    private Long teamIdOf(Long userId) {
        if (userId == null) return null;
        User u = userMapper.selectById(userId);
        return u == null ? null : u.getTeamId();
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }
}
