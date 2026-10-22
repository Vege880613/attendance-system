package com.attendance.util;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * CSV 生成工具（复刻 Node 版 toCSV）
 * UTF-8 BOM + 每值双引号包裹 + " → "" + null → 空串
 */
public class CsvUtil {

    public static final String BOM = "﻿";

    public static String render(List<String> columns, List<Map<String, Object>> rows) {
        StringBuilder sb = new StringBuilder();
        sb.append(BOM);
        sb.append(String.join(",", columns));
        sb.append("\n");
        for (Map<String, Object> row : rows) {
            String line = columns.stream()
                    .map(c -> {
                        Object v = row.get(c);
                        String s = v == null ? "" : String.valueOf(v).replace("\"", "\"\"");
                        return "\"" + s + "\"";
                    })
                    .collect(Collectors.joining(","));
            sb.append(line);
            sb.append("\n");
        }
        return sb.toString();
    }
}
