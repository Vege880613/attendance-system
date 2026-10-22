package com.attendance.controller;

import com.attendance.common.BizException;
import com.attendance.common.UserContext;
import com.attendance.entity.Team;
import com.attendance.entity.User;
import com.attendance.mapper.TeamMapper;
import com.attendance.mapper.UserMapper;
import com.attendance.security.RequireRole;
import com.attendance.util.CsvResponse;
import com.attendance.util.CsvUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 班组接口（/api/teams）
 */
@RestController
@RequestMapping("/api/teams")
public class TeamsController {

    @Resource
    private TeamMapper teamMapper;
    @Resource
    private UserMapper userMapper;

    @GetMapping
    public Map<String, Object> list() {
        List<Team> teams = teamMapper.selectList(new QueryWrapper<Team>().orderByAsc("id"));
        List<Map<String, Object>> list = teams.stream().map(this::toVo).collect(Collectors.toList());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("list", list);
        return result;
    }

    @GetMapping("/export")
    @RequireRole("manager")
    public ResponseEntity<byte[]> export() {
        List<Team> teams = teamMapper.selectList(new QueryWrapper<Team>().orderByAsc("id"));
        List<String> columns = java.util.Arrays.asList("id", "name", "lead_name", "member_count", "created_at", "created_by", "updated_at", "updated_by");
        List<Map<String, Object>> rows = teams.stream().map(t -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());
            m.put("name", t.getName());
            m.put("lead_name", leadName(t.getLeadUserId()));
            m.put("member_count", memberCount(t.getId()));
            m.put("created_at", t.getCreatedAt());
            m.put("created_by", t.getCreatedBy());
            m.put("updated_at", t.getUpdatedAt());
            m.put("updated_by", t.getUpdatedBy());
            return m;
        }).collect(Collectors.toList());
        return CsvResponse.of("teams_export.csv", CsvUtil.render(columns, rows));
    }

    @GetMapping("/{id}/members")
    public Map<String, Object> members(@PathVariable Long id) {
        List<User> users = userMapper.selectList(new QueryWrapper<User>().eq("team_id", id).orderByAsc("id"));
        List<Map<String, Object>> list = users.stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("username", u.getUsername());
            m.put("name", u.getName());
            m.put("role", u.getRole());
            m.put("hire_date", u.getHireDate());
            m.put("status", u.getStatus());
            return m;
        }).collect(Collectors.toList());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("list", list);
        return result;
    }

    @PostMapping
    @RequireRole("manager")
    public Map<String, Object> create(@RequestBody Map<String, Object> body) {
        String name = str(body.get("name"));
        if (name.isEmpty()) throw BizException.badRequest("班组名称不能为空");
        Team t = new Team();
        t.setName(name);
        t.setLeadUserId(body.get("lead_user_id") == null ? null : Long.valueOf(str(body.get("lead_user_id"))));
        t.setCreatedBy(str(UserContext.getUserId()));
        teamMapper.insert(t);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", t.getId());
        result.put("message", "创建成功");
        return result;
    }

    @PutMapping("/{id}")
    @RequireRole("manager")
    public Map<String, Object> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Team t = teamMapper.selectById(id);
        if (t == null) throw BizException.notFound("班组不存在");
        t.setName(str(body.get("name")));
        t.setLeadUserId(body.get("lead_user_id") == null ? null : Long.valueOf(str(body.get("lead_user_id"))));
        t.setUpdatedBy(str(UserContext.getUserId()));
        t.setUpdatedAt(LocalDateTime.now());
        teamMapper.updateById(t);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "更新成功");
        return result;
    }

    private Map<String, Object> toVo(Team t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.getId());
        m.put("name", t.getName());
        m.put("lead_user_id", t.getLeadUserId());
        m.put("created_at", t.getCreatedAt());
        m.put("created_by", t.getCreatedBy());
        m.put("updated_at", t.getUpdatedAt());
        m.put("updated_by", t.getUpdatedBy());
        m.put("lead_name", leadName(t.getLeadUserId()));
        m.put("member_count", memberCount(t.getId()));
        return m;
    }

    private String leadName(Long leadId) {
        if (leadId == null) return null;
        User u = userMapper.selectById(leadId);
        return u == null ? null : u.getName();
    }

    private Long memberCount(Long teamId) {
        return userMapper.selectCount(new QueryWrapper<User>().eq("team_id", teamId).eq("status", "active"));
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }
}
