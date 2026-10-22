package com.attendance.controller;

import com.attendance.common.BizException;
import com.attendance.common.UserContext;
import com.attendance.entity.Team;
import com.attendance.entity.User;
import com.attendance.mapper.TeamMapper;
import com.attendance.mapper.UserMapper;
import com.attendance.security.RequireRole;
import com.attendance.util.CsvUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 用户接口（/api/users）
 */
@RestController
@RequestMapping("/api/users")
public class UsersController {

    @Resource
    private UserMapper userMapper;
    @Resource
    private TeamMapper teamMapper;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    @GetMapping
    public Map<String, Object> list(@RequestParam(required = false) String keyword,
                                    @RequestParam(required = false) String teamId,
                                    @RequestParam(required = false) String role,
                                    @RequestParam(required = false) String status) {
        QueryWrapper<User> qw = new QueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            qw.and(w -> w.like("name", keyword).or().like("username", keyword));
        }
        if (teamId != null && !teamId.isEmpty()) qw.eq("team_id", Long.valueOf(teamId));
        if (role != null && !role.isEmpty()) qw.eq("role", role);
        if (status != null && !status.isEmpty()) qw.eq("status", status);
        // 班组长仅看本班组
        if ("team_lead".equals(UserContext.getRole())) {
            User me = userMapper.selectById(UserContext.getUserId());
            if (me != null && me.getTeamId() != null) qw.eq("team_id", me.getTeamId());
        }
        qw.orderByAsc("id");
        List<User> users = userMapper.selectList(qw);
        List<Map<String, Object>> list = users.stream().map(this::toVo).collect(Collectors.toList());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("list", list);
        return result;
    }

    @GetMapping("/export")
    @RequireRole("manager")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) String keyword,
                                         @RequestParam(required = false) String teamId,
                                         @RequestParam(required = false) String role,
                                         @RequestParam(required = false) String status) {
        QueryWrapper<User> qw = new QueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            qw.and(w -> w.like("name", keyword).or().like("username", keyword));
        }
        if (teamId != null && !teamId.isEmpty()) qw.eq("team_id", Long.valueOf(teamId));
        if (role != null && !role.isEmpty()) qw.eq("role", role);
        if (status != null && !status.isEmpty()) qw.eq("status", status);
        qw.orderByAsc("id");
        List<User> users = userMapper.selectList(qw);
        List<String> columns = java.util.Arrays.asList("id", "username", "name", "role", "team_name", "hire_date", "status", "created_at", "created_by", "updated_at", "updated_by");
        List<Map<String, Object>> rows = users.stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("username", u.getUsername());
            m.put("name", u.getName());
            m.put("role", u.getRole());
            m.put("team_name", teamName(u.getTeamId()));
            m.put("hire_date", u.getHireDate());
            m.put("status", u.getStatus());
            m.put("created_at", u.getCreatedAt());
            m.put("created_by", u.getCreatedBy());
            m.put("updated_at", u.getUpdatedAt());
            m.put("updated_by", u.getUpdatedBy());
            return m;
        }).collect(Collectors.toList());
        String csv = CsvUtil.render(columns, rows);
        return csvResponse("users_export.csv", csv);
    }

    @PostMapping
    @RequireRole("manager")
    public Map<String, Object> create(@RequestBody Map<String, Object> body) {
        String username = str(body.get("username"));
        String password = str(body.get("password"));
        String name = str(body.get("name"));
        String hireDate = str(body.get("hire_date"));
        if (username.isEmpty() || password.isEmpty() || name.isEmpty() || hireDate.isEmpty()) {
            throw BizException.badRequest("缺少必要字段");
        }
        Long exist = userMapper.selectCount(new QueryWrapper<User>().eq("username", username));
        if (exist != null && exist > 0) {
            throw BizException.badRequest("用户名已存在");
        }
        User u = new User();
        u.setUsername(username);
        u.setPasswordHash(encoder.encode(password));
        u.setName(name);
        u.setRole(str(body.get("role")).isEmpty() ? "employee" : str(body.get("role")));
        u.setTeamId(body.get("team_id") == null ? null : Long.valueOf(str(body.get("team_id"))));
        u.setHireDate(LocalDate.parse(hireDate));
        u.setStatus("active");
        u.setEmployeeId(str(body.get("employee_id")));
        u.setCompanyHireDate(body.get("company_hire_date") == null || str(body.get("company_hire_date")).isEmpty()
                ? null : LocalDate.parse(str(body.get("company_hire_date"))));
        u.setCreatedBy(str(UserContext.getUserId()));
        userMapper.insert(u);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", u.getId());
        result.put("message", "创建成功");
        return result;
    }

    @PutMapping("/{id}")
    @RequireRole("manager")
    public Map<String, Object> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        User u = userMapper.selectById(id);
        if (u == null) throw BizException.notFound("用户不存在");
        u.setName(str(body.get("name")));
        u.setRole(str(body.get("role")));
        u.setTeamId(body.get("team_id") == null ? null : Long.valueOf(str(body.get("team_id"))));
        u.setHireDate(LocalDate.parse(str(body.get("hire_date"))));
        u.setEmployeeId(str(body.get("employee_id")));
        u.setCompanyHireDate(body.get("company_hire_date") == null || str(body.get("company_hire_date")).isEmpty()
                ? null : LocalDate.parse(str(body.get("company_hire_date"))));
        u.setUpdatedBy(str(UserContext.getUserId()));
        u.setUpdatedAt(java.time.LocalDateTime.now());
        userMapper.updateById(u);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "更新成功");
        return result;
    }

    @PutMapping("/{id}/status")
    @RequireRole("manager")
    public Map<String, Object> updateStatus(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String status = str(body.get("status"));
        if (!"active".equals(status) && !"resigned".equals(status)) {
            throw BizException.badRequest("状态不合法");
        }
        User u = userMapper.selectById(id);
        if (u == null) throw BizException.notFound("用户不存在");
        u.setStatus(status);
        u.setUpdatedBy(str(UserContext.getUserId()));
        u.setUpdatedAt(java.time.LocalDateTime.now());
        userMapper.updateById(u);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "状态更新成功");
        return result;
    }

    private Map<String, Object> toVo(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("username", u.getUsername());
        m.put("name", u.getName());
        m.put("role", u.getRole());
        m.put("team_id", u.getTeamId());
        m.put("hire_date", u.getHireDate());
        m.put("status", u.getStatus());
        m.put("employee_id", u.getEmployeeId());
        m.put("company_hire_date", u.getCompanyHireDate());
        m.put("created_at", u.getCreatedAt());
        m.put("created_by", u.getCreatedBy());
        m.put("updated_at", u.getUpdatedAt());
        m.put("updated_by", u.getUpdatedBy());
        m.put("team_name", teamName(u.getTeamId()));
        return m;
    }

    private String teamName(Long teamId) {
        if (teamId == null) return null;
        Team t = teamMapper.selectById(teamId);
        return t == null ? null : t.getName();
    }

    private ResponseEntity<byte[]> csvResponse(String filename, String csv) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, "text/csv; charset=utf-8")
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename)
                .body(csv.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }
}
