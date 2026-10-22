package com.attendance.common;

/**
 * 业务异常：携带用户可见的 message 文案与 HTTP 状态码
 * 由 GlobalExceptionHandler 统一转为 { "message": "..." }
 */
public class BizException extends RuntimeException {

    private final int code;

    public BizException(String message) {
        this(message, 400);
    }

    public BizException(String message, int code) {
        super(message);
        this.code = code;
    }

    public int getCode() {
        return code;
    }

    public static BizException badRequest(String message) {
        return new BizException(message, 400);
    }

    public static BizException forbidden(String message) {
        return new BizException(message, 403);
    }

    public static BizException notFound(String message) {
        return new BizException(message, 404);
    }

    public static BizException unauthorized(String message) {
        return new BizException(message, 401);
    }
}
