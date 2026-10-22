package com.attendance.security;

import com.attendance.common.UserContext;
import com.attendance.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;

/**
 * JWT 鉴权拦截器（等价 Node 版 authRequired + requireRole）
 * 401: 未提供认证令牌 / 令牌无效或已过期 / 未认证
 * 403: 无权访问该资源
 */
public class AuthInterceptor implements HandlerInterceptor {

    private static final List<String> WHITELIST = Arrays.asList(
            "/api/auth/login",
            "/api/health"
    );

    private final JwtProperties jwtProperties;

    public AuthInterceptor(JwtProperties jwtProperties) {
        this.jwtProperties = jwtProperties;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        String uri = request.getRequestURI();
        if (isWhitelist(uri)) {
            return true;
        }

        String header = request.getHeader("Authorization");
        String token = (header != null && header.startsWith("Bearer ")) ? header.substring(7).trim() : null;
        if (token == null || token.isEmpty()) {
            writeJson(response, 401, "未提供认证令牌");
            return false;
        }

        UserContext.CurrentUser user;
        try {
            user = parse(token);
        } catch (Exception e) {
            writeJson(response, 401, "令牌无效或已过期");
            return false;
        }
        UserContext.set(user);

        // 角色校验（@RequireRole）
        if (handler instanceof HandlerMethod) {
            HandlerMethod hm = (HandlerMethod) handler;
            RequireRole ann = hm.getMethodAnnotation(RequireRole.class);
            if (ann == null) {
                ann = hm.getBeanType().getAnnotation(RequireRole.class);
            }
            if (ann != null) {
                String role = user.getRole();
                if (role == null) {
                    writeJson(response, 401, "未认证");
                    return false;
                }
                if (!Arrays.asList(ann.value()).contains(role)) {
                    writeJson(response, 403, "无权访问该资源");
                    return false;
                }
            }
        }
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        UserContext.clear();
    }

    private boolean isWhitelist(String uri) {
        return WHITELIST.contains(uri);
    }

    private UserContext.CurrentUser parse(String token) {
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

    private void writeJson(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}
