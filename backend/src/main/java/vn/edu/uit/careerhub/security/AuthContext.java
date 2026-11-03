package vn.edu.uit.careerhub.security;

import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;

public final class AuthContext {
    private AuthContext() {}

    public static AuthPrincipal requireRole(AuthPrincipal principal, UserRole... roles) {
        if (principal == null) {
            throw new AppException(ErrorType.UNAUTHENTICATED, "AUTH_ACCESS_TOKEN_MISSING", "Vui lòng đăng nhập để tiếp tục.");
        }
        boolean allowed = java.util.Arrays.stream(roles).anyMatch(role -> role == principal.role());
        if (!allowed) {
            throw new AppException(ErrorType.FORBIDDEN, "AUTH_FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
        }
        if (principal.role() == UserRole.STUDENT && principal.studentProfileId() == null) {
            throw new AppException(ErrorType.FORBIDDEN, "AUTH_CONTEXT_MISSING",
                    "Tài khoản chưa được liên kết với hồ sơ sinh viên.");
        }
        if (principal.role() == UserRole.COMPANY && principal.companyId() == null) {
            throw new AppException(ErrorType.FORBIDDEN, "AUTH_CONTEXT_MISSING",
                    "Tài khoản chưa được liên kết với doanh nghiệp.");
        }
        return principal;
    }
}
