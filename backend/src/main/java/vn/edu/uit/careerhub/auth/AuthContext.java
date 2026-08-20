package vn.edu.uit.careerhub.auth;

import org.springframework.http.HttpStatus;

import vn.edu.uit.careerhub.common.AppException;

public final class AuthContext {
    private AuthContext() {}

    public static AuthPrincipal requireRole(AuthPrincipal principal, UserRole... roles) {
        if (principal == null) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "AUTH_ACCESS_TOKEN_MISSING", "Vui lòng đăng nhập để tiếp tục.");
        }
        boolean allowed = java.util.Arrays.stream(roles).anyMatch(role -> role == principal.role());
        if (!allowed) {
            throw new AppException(HttpStatus.FORBIDDEN, "AUTH_FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
        }
        if (principal.role() == UserRole.STUDENT && principal.studentProfileId() == null) {
            throw new AppException(HttpStatus.FORBIDDEN, "AUTH_CONTEXT_MISSING",
                    "Tài khoản chưa được liên kết với hồ sơ sinh viên.");
        }
        if (principal.role() == UserRole.COMPANY && principal.companyId() == null) {
            throw new AppException(HttpStatus.FORBIDDEN, "AUTH_CONTEXT_MISSING",
                    "Tài khoản chưa được liên kết với doanh nghiệp.");
        }
        return principal;
    }
}
