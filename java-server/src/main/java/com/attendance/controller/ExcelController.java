package com.attendance.controller;

import com.alibaba.excel.EasyExcel;
import com.attendance.common.BizException;
import com.attendance.common.UserContext;
import com.attendance.entity.AttendanceRecord;
import com.attendance.entity.User;
import com.attendance.mapper.AttendanceRecordMapper;
import com.attendance.mapper.UserMapper;
import com.attendance.security.RequireRole;
import com.attendance.util.BusinessRules;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Excel 导入导出接口（/api/excel）
 */
@RestController
@RequestMapping("/api/excel")
public class ExcelController {

    @Resource
    private UserMapper userMapper;
    @Resource
    private AttendanceRecordMapper attendanceRecordMapper;

    @PostMapping("/parse-excel")
    @RequireRole("manager")
    public Map<String, Object> parseExcel(@RequestBody Map<String, Object> body) {
        String fileBase64 = str(body.get("fileBase64"));
        if (fileBase64.isEmpty()) throw BizException.badRequest("请上传文件");
        int targetYear = body.get("year") == null ? LocalDate.now().getYear() : Integer.parseInt(str(body.get("year")));

        try {
            byte[] bytes = Base64.getDecoder().decode(fileBase64);
            List<Map<Integer, String>> rows = EasyExcel.read(new ByteArrayInputStream(bytes))
                    .sheet().headRowNumber(0).doReadSync();

            List<User> users = userMapper.selectList(new QueryWrapper<User>().eq("status", "active"));
            Map<String, User> byEmployeeId = new LinkedHashMap<>();
            Map<String, User> byName = new LinkedHashMap<>();
            for (User u : users) {
                if (u.getEmployeeId() != null) byEmployeeId.put(u.getEmployeeId().trim(), u);
                if (u.getName() != null) byName.put(u.getName().trim(), u);
                byName.put(u.getUsername().trim(), u);
            }

            List<Map<String, Object>> parsed = new ArrayList<>();
            List<String> errors = new ArrayList<>();

            int headerRowIdx = -1;
            int dateRowIdx = -1;
            for (int i = 0; i < rows.size(); i++) {
                Map<Integer, String> row = rows.get(i);
                if ("工号".equals(cell(row, 0)) && "姓名".equals(cell(row, 1))) {
                    headerRowIdx = i;
                    dateRowIdx = i + 1;
                    break;
                }
            }
            if (headerRowIdx == -1) {
                throw BizException.badRequest("无法找到表头行，请确认文件格式正确");
            }

            Map<Integer, String> dateRow = rows.get(dateRowIdx);
            Map<Integer, String> dateMap = new LinkedHashMap<>();
            for (int col = 4; col <= 34; col++) {
                String dateStr = cell(dateRow, col).trim();
                if (dateStr.matches("\\d{2}/\\d{2}")) {
                    String[] md = dateStr.split("/");
                    dateMap.put(col, targetYear + "-" + md[0] + "-" + md[1]);
                }
            }

            Map<String, Object> current = null;
            for (int i = dateRowIdx + 1; i < rows.size(); i++) {
                Map<Integer, String> row = rows.get(i);
                String col0 = cell(row, 0).trim();
                String col3 = cell(row, 3).trim();
                if (col0.isEmpty() && col3.isEmpty()) continue;

                if ("上班".equals(col3)) {
                    String employeeId = col0;
                    String name = cell(row, 1).trim();
                    User user = byEmployeeId.get(employeeId) != null ? byEmployeeId.get(employeeId) : byName.get(name);
                    if (user == null) {
                        errors.add("第" + (i + 1) + "行: 找不到员工\"" + name + "\"(工号:" + employeeId + ")");
                        current = null;
                        continue;
                    }
                    current = new LinkedHashMap<>();
                    current.put("user_id", user.getId());
                    current.put("user_name", user.getName());
                    current.put("employee_id", user.getEmployeeId());
                    Map<String, String> checkIns = new LinkedHashMap<>();
                    for (Map.Entry<Integer, String> e : dateMap.entrySet()) {
                        String t = cell(row, e.getKey()).trim();
                        if (t.matches("\\d{2}:\\d{2}")) checkIns.put(e.getValue(), t);
                    }
                    current.put("checkIns", checkIns);
                    current.put("checkOuts", new LinkedHashMap<String, String>());
                } else if ("下班".equals(col3) && current != null) {
                    Map<String, String> checkOuts = new LinkedHashMap<>();
                    for (Map.Entry<Integer, String> e : dateMap.entrySet()) {
                        String t = cell(row, e.getKey()).trim();
                        if (t.matches("\\d{2}:\\d{2}")) checkOuts.put(e.getValue(), t);
                    }
                    current.put("checkOuts", checkOuts);
                    Map<String, String> checkIns = (Map<String, String>) current.get("checkIns");
                    for (String date : dateMap.values()) {
                        String ci = checkIns.getOrDefault(date, "");
                        String co = checkOuts.getOrDefault(date, "");
                        if (!ci.isEmpty() || !co.isEmpty()) {
                            Map<String, Object> p = new LinkedHashMap<>();
                            p.put("user_id", current.get("user_id"));
                            p.put("user_name", current.get("user_name"));
                            p.put("employee_id", current.get("employee_id"));
                            p.put("date", date);
                            p.put("check_in", ci);
                            p.put("check_out", co);
                            parsed.add(p);
                        }
                    }
                    current = null;
                }
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("parsed", parsed);
            result.put("errors", errors);
            result.put("total", parsed.size());
            return result;
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            throw new BizException("解析Excel失败: " + e.getMessage(), 500);
        }
    }

    @PostMapping("/import")
    @RequireRole("manager")
    public Map<String, Object> importExcel(@RequestBody Map<String, Object> body) {
        List<Map<String, Object>> data = body.get("data") == null ? null : (List<Map<String, Object>>) body.get("data");
        if (data == null) throw BizException.badRequest("参数不合法");

        String createdBy = str(UserContext.getUserId());
        for (Map<String, Object> r : data) {
            Long userId = Long.valueOf(str(r.get("user_id")));
            LocalDate date = LocalDate.parse(str(r.get("date")));
            String checkIn = str(r.get("check_in"));
            String checkOut = str(r.get("check_out"));
            double effective = BusinessRules.calcEffectiveHours(checkIn, checkOut);
            int shortage = BusinessRules.isShortage(effective) ? 1 : 0;
            AttendanceRecord rec = new AttendanceRecord();
            rec.setUserId(userId);
            rec.setWorkDate(date);
            rec.setCheckIn(checkIn.isEmpty() ? null : checkIn);
            rec.setCheckOut(checkOut.isEmpty() ? null : checkOut);
            rec.setEffectiveHours(BigDecimal.valueOf(effective));
            rec.setIsShortage(shortage);
            rec.setRemark(str(r.get("remark")));
            rec.setCreatedBy(createdBy);
            attendanceRecordMapper.upsert(rec);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "成功导入 " + data.size() + " 条考勤记录");
        return result;
    }

    @GetMapping("/template")
    @RequireRole("manager")
    public ResponseEntity<byte[]> template() {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            List<List<String>> head = new ArrayList<>();
            head.add(java.util.Arrays.asList("工号"));
            head.add(java.util.Arrays.asList("姓名"));
            head.add(java.util.Arrays.asList("部门"));
            head.add(java.util.Arrays.asList("上班/下班"));
            for (int d = 1; d <= 31; d++) head.add(java.util.Arrays.asList(String.format("08/%02d", d)));
            List<String> sampleIn = new ArrayList<>();
            sampleIn.add("01000001"); sampleIn.add("张三"); sampleIn.add("IT开发中心"); sampleIn.add("上班");
            List<String> sampleOut = new ArrayList<>();
            sampleOut.add(""); sampleOut.add(""); sampleOut.add(""); sampleOut.add("下班");
            for (int d = 1; d <= 31; d++) {
                boolean weekend = false;
                sampleIn.add(weekend ? "休息" : "08:20");
                sampleOut.add(weekend ? "休息" : "17:00");
            }
            List<List<String>> data = new ArrayList<>();
            data.add(sampleIn);
            data.add(sampleOut);
            EasyExcel.write(out).head(head).sheet("考勤数据").doWrite(data);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=attendance_template.xlsx")
                    .body(out.toByteArray());
        } catch (Exception e) {
            throw new BizException("生成模板失败: " + e.getMessage(), 500);
        }
    }

    private String cell(Map<Integer, String> row, int idx) {
        String v = row.get(idx);
        return v == null ? "" : v.trim();
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }
}
