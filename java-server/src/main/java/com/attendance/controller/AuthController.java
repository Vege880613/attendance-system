package com.attendance.controller;

import com.attendance.common.BizException;
import com.attendance.common.UserContext;
import com.attendance.entity.Team;
import com.attendance.entity.User;
import com.attendance.mapper.TeamMapper;
import com.attendance.mapper.UserMapper;
import com.attendance.security.JwtUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 认证接口（/api/auth）
 * login: { username, password } → { token, user }
 * me:    → { user }
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Resource
    private UserMapper userMapper;
    @Resource
    private TeamMapper teamMapper;
    @Resource
    private JwtUtil jwtUtil;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, Object> body) {
        String username = body == null ? null : (String) body.get("username");
        String password = body == null ? null : (String) body.get("password");
        if (username == null || username.isEmpty() || password == null || password.isEmpty()) {
            throw BizException.badRequest("用户名和密码不能为空");
        }
        User user = userMapper.selectOne(new QueryWrapper<User>().eq("username", username));
        if (user == null) {
            throw BizException.unauthorized("用户名或密码错误");
        }
        if ("resigned".equals(user.getStatus())) {
            throw new BizException("该账号已离职", 403);
        }
        if (!encoder.matches(password, user.getPasswordHash())) {
            throw BizException.unauthorized("用户名或密码错误");
        }
        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), user.getRole());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("token", token);
        result.put("user", buildUserVo(user));
        return result;
    }

    @GetMapping("/me")
    public Map<String, Object> me() {
        Long id = UserContext.getUserId();
        User user = userMapper.selectById(id);
        if (user == null) {
            throw BizException.notFound("用户不存在");
        }
        Map<String, Object> vo = buildUserVo(user);
        vo.put("status", user.getStatus());
        vo.put("team_name", resolveTeamName(user.getTeamId()));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("user", vo);
        return result;
    }

    private Map<String, Object> buildUserVo(User user) {
        Map<String, Object> vo = new LinkedHashMap<>();
        vo.put("id", user.getId());
        vo.put("username", user.getUsername());
        vo.put("name", user.getName());
        vo.put("role", user.getRole());
        vo.put("team_id", user.getTeamId());
        vo.put("hire_date", user.getHireDate());
        return vo;
    }

    private String resolveTeamName(Long teamId) {
        if (teamId == null) return null;
        Team team = teamMapper.selectById(teamId);
        return team == null ? null : team.getName();
    }
}
