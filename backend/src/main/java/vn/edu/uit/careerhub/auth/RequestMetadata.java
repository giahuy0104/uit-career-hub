package vn.edu.uit.careerhub.auth;

import jakarta.servlet.http.HttpServletRequest;

public record RequestMetadata(String ipAddress, String userAgent) {
    public static RequestMetadata from(HttpServletRequest request) {
        String userAgent = request.getHeader("user-agent");
        if (userAgent != null && userAgent.length() > 512) userAgent = userAgent.substring(0, 512);
        String forwarded = request.getHeader("x-forwarded-for");
        String ip = forwarded == null || forwarded.isBlank()
                ? request.getRemoteAddr() : forwarded.split(",", 2)[0].strip();
        return new RequestMetadata(ip == null || ip.isBlank() ? null : ip, userAgent);
    }
}
