package com.attendance.config;

import com.attendance.entity.User;
import com.attendance.mapper.UserMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;
import java.time.LocalDate;

/**
 * 数据初始化：确保 admin 账号存在（等价 Node 版 app.js ensureAdmin）
 */
@Component
public class DataInitializer implements CommandLineRunner {

    @Resource
    private UserMapper userMapper;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    @Override
    public void run(String... args) {
        Long count = userMapper.selectCount(new QueryWrapper<User>().eq("username", "admin"));
        if (count == null || count == 0) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setPasswordHash(encoder.encode("admin123"));
            admin.setName("系统管理员");
            admin.setRole("manager");
            admin.setHireDate(LocalDate.of(2020, 1, 1));
            admin.setStatus("active");
            userMapper.insert(admin);
            System.out.println("✅ 已创建默认管理员账号 (admin/admin123)");
        }
    }
}
