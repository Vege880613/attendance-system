package com.attendance.support;

import com.attendance.security.JwtUtil;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;
import java.time.LocalDate;
import java.util.Map;

/**
 * 测试数据助手（等价 Node 版 tests/seed.js）
 * 固定数据：团队 id=1「测试一组」、组长 id=2「lead」、员工 id=3「alice」、项目 id=1、员工年假 5 天
 */
@Component
public class TestSupport {

    private final JdbcTemplate jdbc;
    private final JwtUtil jwtUtil;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public TestSupport(JdbcTemplate jdbc, JwtUtil jwtUtil) {
        this.jdbc = jdbc;
        this.jwtUtil = jwtUtil;
    }

    public JdbcTemplate db() {
        return jdbc;
    }

    /** 清空并重建测试数据 */
    public void seed() {
        int year = LocalDate.now().getYear();
        jdbc.execute("DELETE FROM attendance_requests");
        jdbc.execute("DELETE FROM overtime_units");
        jdbc.execute("DELETE FROM leave_balances");
        jdbc.execute("DELETE FROM attendance_records");
        jdbc.execute("DELETE FROM users WHERE id > 1");
        jdbc.execute("DELETE FROM teams");
        jdbc.execute("DELETE FROM projects");
        jdbc.execute("DELETE FROM holidays");
        jdbc.execute("DELETE FROM audit_logs WHERE action = 'create_project'");

        jdbc.update("INSERT INTO teams (id, name, lead_user_id) VALUES (1, '测试一组', 2)");
        String hash = encoder.encode("123456");
        jdbc.update("INSERT INTO users (id, username, password_hash, name, role, team_id, hire_date, status) VALUES (2, 'lead', ?, '李组长', 'team_lead', 1, '2018-01-10', 'active')", hash);
        jdbc.update("INSERT INTO users (id, username, password_hash, name, role, team_id, hire_date, status) VALUES (3, 'alice', ?, '爱丽丝', 'employee', 1, '2020-06-15', 'active')", hash);
        jdbc.update("INSERT INTO projects (id, name, type, status) VALUES (1, '项目Alpha', 'project', 'active')");
        jdbc.update("INSERT INTO leave_balances (user_id, leave_type, year, entitled_days, used_days) VALUES (3, 'annual', ?, 5, 0)", year);
        jdbc.execute("ALTER TABLE users AUTO_INCREMENT = 4");
    }

    /** 生成指定用户的 JWT（等价 Node 版 generateToken） */
    public String token(Long userId) {
        Map<?, ?> user = jdbc.queryForMap("SELECT * FROM users WHERE id = ?", userId);
        return jwtUtil.generateToken(userId, (String) user.get("username"), (String) user.get("role"));
    }

    public String adminToken() {
        return token(1L);
    }

    public String employeeToken() {
        return token(3L);
    }

    public String teamLeadToken() {
        return token(2L);
    }
}
