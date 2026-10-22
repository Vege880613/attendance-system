package com.attendance.controller;

import com.attendance.common.BizException;
import com.attendance.common.UserContext;
import com.attendance.entity.AuditLog;
import com.attendance.entity.Project;
import com.attendance.mapper.AuditLogMapper;
import com.attendance.mapper.ProjectMapper;
import com.attendance.security.RequireRole;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 项目接口（/api/projects）
 */
@RestController
@RequestMapping("/api/projects")
public class ProjectsController {

    @Resource
    private ProjectMapper projectMapper;
    @Resource
    private AuditLogMapper auditLogMapper;

    @GetMapping
    public Map<String, Object> list(@RequestParam(required = false) String type,
                                    @RequestParam(required = false) String status) {
        QueryWrapper<Project> qw = new QueryWrapper<>();
        if (type != null && !type.isEmpty()) qw.eq("type", type);
        if (status != null && !status.isEmpty()) qw.eq("status", status);
        qw.orderByDesc("id");
        List<Project> projects = projectMapper.selectList(qw);
        List<Map<String, Object>> list = projects.stream().map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.getId());
            m.put("name", p.getName());
            m.put("type", p.getType());
            m.put("description", p.getDescription());
            m.put("status", p.getStatus());
            m.put("created_at", p.getCreatedAt());
            m.put("created_by", p.getCreatedBy());
            m.put("updated_at", p.getUpdatedAt());
            m.put("updated_by", p.getUpdatedBy());
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
        if (name.isEmpty()) throw BizException.badRequest("项目名称不能为空");
        Project p = new Project();
        p.setName(name);
        p.setType(str(body.get("type")).isEmpty() ? "project" : str(body.get("type")));
        p.setDescription(str(body.get("description")));
        p.setStatus(str(body.get("status")).isEmpty() ? "active" : str(body.get("status")));
        p.setCreatedBy(str(UserContext.getUserId()));
        projectMapper.insert(p);
        AuditLog log = new AuditLog();
        log.setUserId(UserContext.getUserId());
        log.setAction("create_project");
        log.setDetail("创建项目 " + name);
        auditLogMapper.insert(log);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", p.getId());
        result.put("message", "创建成功");
        return result;
    }

    @PutMapping("/{id}")
    @RequireRole("manager")
    public Map<String, Object> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Project p = projectMapper.selectById(id);
        if (p == null) throw BizException.notFound("项目不存在");
        p.setName(str(body.get("name")));
        p.setType(str(body.get("type")));
        p.setDescription(str(body.get("description")));
        p.setStatus(str(body.get("status")));
        p.setUpdatedBy(str(UserContext.getUserId()));
        p.setUpdatedAt(java.time.LocalDateTime.now());
        projectMapper.updateById(p);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "更新成功");
        return result;
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }
}
