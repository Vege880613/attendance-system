package com.attendance.util;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;

/**
 * CSV 文件下载响应（复刻 Node 版 Content-Type/Content-Disposition）
 */
public class CsvResponse {

    public static ResponseEntity<byte[]> of(String filename, String csv) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, "text/csv; charset=utf-8")
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename)
                .body(csv.getBytes(StandardCharsets.UTF_8));
    }
}
