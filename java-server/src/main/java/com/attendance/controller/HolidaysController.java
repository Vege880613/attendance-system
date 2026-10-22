package com.attendance.controller;

import com.attendance.common.BizException;
import com.attendance.common.UserContext;
import com.attendance.entity.Holiday;
import com.attendance.mapper.HolidayMapper;
import com.attendance.security.RequireRole;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 节假日接口（/api/holidays）
 */
@RestController
@RequestMapping("/api/holidays")
public class HolidaysController {

    @Resource
    private HolidayMapper holidayMapper;

    @GetMapping
    public Map<String, Object> list(@RequestParam(required = false) Integer year) {
        QueryWrapper<Holiday> qw = new QueryWrapper<>();
        if (year != null) qw.eq("year", year);
        qw.orderByAsc("date");
        List<Holiday> holidays = holidayMapper.selectList(qw);
        List<Map<String, Object>> list = holidays.stream().map(h -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", h.getId());
            m.put("date", h.getDate());
            m.put("name", h.getName());
            m.put("type", h.getType());
            m.put("year", h.getYear());
            m.put("created_at", h.getCreatedAt());
            m.put("created_by", h.getCreatedBy());
            m.put("updated_at", h.getUpdatedAt());
            m.put("updated_by", h.getUpdatedBy());
            return m;
        }).collect(Collectors.toList());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("list", list);
        return result;
    }

    @PostMapping
    @RequireRole("manager")
    public Map<String, Object> create(@RequestBody Map<String, Object> body) {
        String date = str(body.get("date"));
        String name = str(body.get("name"));
        String type = str(body.get("type"));
        String year = str(body.get("year"));
        if (date.isEmpty() || name.isEmpty() || type.isEmpty() || year.isEmpty()) {
            throw BizException.badRequest("缺少必要字段");
        }
        Long exist = holidayMapper.selectCount(new QueryWrapper<Holiday>().eq("date", LocalDate.parse(date)));
        if (exist != null && exist > 0) {
            throw BizException.badRequest("该日期已存在");
        }
        Holiday h = new Holiday();
        h.setDate(LocalDate.parse(date));
        h.setName(name);
        h.setType(type);
        h.setYear(Integer.valueOf(year));
        h.setCreatedBy(str(UserContext.getUserId()));
        holidayMapper.insert(h);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", h.getId());
        result.put("message", "添加成功");
        return result;
    }

    @DeleteMapping("/{id}")
    @RequireRole("manager")
    public Map<String, Object> delete(@PathVariable Long id) {
        holidayMapper.deleteById(id);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "删除成功");
        return result;
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }
}
