package com.attendance.security;

import com.attendance.common.UserContext;
import com.attendance.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * JWT 生成与校验（HS256，payload {id, username, role}，12h 过期）
 * 与 Node 版 jsonwebtoken 默认行为一致
 */
@Component
public class JwtUtil {

    @Resource
    private JwtProperties jwtProperties;

    /** 生成 token */
    public String generateToken(Long id, String username, String role) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("id", id);
        claims.put("username", username);
        claims.put("role", role);
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setClaims(claims)
                .setSubject(username)
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + jwtProperties.getExpiresInMs()))
                .signWith(SignatureAlgorithm.HS256, jwtProperties.getSecret().getBytes())
                .compact();
    }

    /** 解析 token，返回当前用户；失败抛异常 */
    public UserContext.CurrentUser parseToken(String token) {
        Claims claims = Jwts.parser()
                .setSigningKey(jwtProperties.getSecret().getBytes())
                .parseClaimsJws(token)
                .getBody();
        Number idNum = claims.get("id", Number.class);
        Long id = idNum == null ? null : idNum.longValue();
        String username = claims.get("username", String.class);
        String role = claims.get("role", String.class);
        return new UserContext.CurrentUser(id, username, role);
    }
}
