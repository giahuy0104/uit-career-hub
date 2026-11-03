
package vn.edu.uit.careerhub.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import vn.edu.uit.careerhub.config.AppProperties;
import vn.edu.uit.careerhub.dto.IssuedSession;
import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.dto.UserDto;
import vn.edu.uit.careerhub.dto.request.StudentRegistrationRequest;
import vn.edu.uit.careerhub.dto.response.SessionResponse;
import vn.edu.uit.careerhub.entity.AuthUser;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.enums.UserStatus;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.repository.AuditRepository;
import vn.edu.uit.careerhub.repository.AuthRepository;
import vn.edu.uit.careerhub.security.TokenService;

@Service
public class AuthService {
    private final AuthRepository repository;
    private final AuditRepository audit;
    private final TokenService tokens;
    private final PasswordEncoder passwords;
    private final AppProperties.Security configuration;

    public AuthService(AuthRepository repository, AuditRepository audit, TokenService tokens, PasswordEncoder passwords, AppProperties properties) {
        this.repository = repository;
        this.audit = audit;
        this.tokens = tokens;
        this.passwords = passwords;
        this.configuration = properties.security();
    }

    public IssuedSession login(String email, String password, RequestMetadata metadata) {
        AuthUser user = repository.findUserByEmail(email.toLowerCase()).orElse(null);
        if (user == null || user.passwordHash() == null) {
            audit.record(user == null ? null : user.id(), "AUTH_LOGIN_FAILED", "USER",
                    user == null ? null : user.id(), Map.of("reason", "INVALID_CREDENTIALS"), metadata);
            throw invalidCredentials();
        }
        if (user.status() == UserStatus.LOCKED && user.lockedUntil() != null
                && !user.lockedUntil().isAfter(Instant.now())) {
            repository.unlockIfExpired(user.id());
            user = repository.findUserById(user.id()).orElse(user);
        }
        if (user.status() == UserStatus.LOCKED) {
            throw new AppException(ErrorType.LOCKED, "AUTH_ACCOUNT_LOCKED",
                    "Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau.");
        }
        if (!passwords.matches(password, user.passwordHash())) {
            repository.recordFailedLogin(user.id());
            audit.record(user.id(), "AUTH_LOGIN_FAILED", "USER", user.id(),
                    Map.of("reason", "INVALID_CREDENTIALS"), metadata);
            throw invalidCredentials();
        }
        if (user.status() != UserStatus.ACTIVE) {
            throw new AppException(ErrorType.FORBIDDEN, "AUTH_ACCOUNT_INACTIVE",
                    "Tài khoản chưa được kích hoạt hoặc đã bị tạm ngưng.");
        }
        if (user.role() == UserRole.STUDENT && !isAllowedStudentEmail(user.email())) {
            throw new AppException(ErrorType.FORBIDDEN, "AUTH_STUDENT_EMAIL_NOT_ALLOWED",
                    "Tài khoản sinh viên phải sử dụng email UIT hợp lệ.");
        }
        repository.markLoginSucceeded(user.id());
        audit.record(user.id(), "AUTH_LOGIN_SUCCEEDED", "USER", user.id(), Map.of(), metadata);
        return issueSession(user, metadata);
    }

    public IssuedSession registerStudent(StudentRegistrationRequest input, RequestMetadata metadata) {
        String email = input.email().strip().toLowerCase();
        String studentCode = input.studentCode().strip();
        String fullName = input.fullName().strip().replaceAll("\\s+", " ");
        if (!isAllowedStudentEmail(email)) {
            throw new AppException(ErrorType.INVALID_INPUT, "AUTH_REGISTRATION_EMAIL_NOT_ALLOWED",
                    "Vui lòng sử dụng email UIT hợp lệ để đăng ký.");
        }
        String emailAccount = email.substring(0, email.lastIndexOf('@'));
        if (!emailAccount.equalsIgnoreCase(studentCode)) {
            throw new AppException(ErrorType.INVALID_INPUT, "AUTH_REGISTRATION_STUDENT_CODE_MISMATCH",
                    "Mã số sinh viên phải trùng với phần tên trong email UIT.");
        }

        UUID userId;
        try {
            userId = repository.createStudentAccount(email, passwords.encode(input.password()), fullName, studentCode);
        } catch (DuplicateKeyException error) {
            throw new AppException(ErrorType.CONFLICT, "AUTH_REGISTRATION_CONFLICT",
                    "Email hoặc mã số sinh viên đã được sử dụng.");
        }
        AuthUser user = repository.findUserById(userId)
                .orElseThrow(() -> new IllegalStateException("Không thể đọc tài khoản vừa đăng ký."));
        audit.record(userId, "AUTH_STUDENT_REGISTERED", "USER", userId,
                Map.of("studentCode", studentCode), metadata);
        return issueSession(user, metadata);
    }

    public IssuedSession refresh(String refreshToken, RequestMetadata metadata) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new AppException(ErrorType.UNAUTHENTICATED, "AUTH_REFRESH_TOKEN_MISSING", "Phiên đăng nhập không tồn tại.");
        }
        String nextToken = tokens.createRefreshToken();
        AuthUser user = repository.rotateRefreshToken(tokens.hashOpaqueToken(refreshToken), UUID.randomUUID(),
                tokens.hashOpaqueToken(nextToken), refreshExpiry(), metadata).orElseThrow(() ->
                    new AppException(ErrorType.UNAUTHENTICATED, "AUTH_INVALID_REFRESH_TOKEN",
                            "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."));
        TokenService.AccessToken access = tokens.signAccessToken(user);
        return new IssuedSession(nextToken, new SessionResponse(access.accessToken(), access.expiresIn(), UserDto.from(user)));
    }

    public void logout(String refreshToken, RequestMetadata metadata) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            repository.revokeRefreshToken(tokens.hashOpaqueToken(refreshToken));
        }
        audit.record(null, "AUTH_LOGOUT", "AUTH_SESSION", null, Map.of(), metadata);
    }

    public void activateCompanyAccount(String token, String password, RequestMetadata metadata) {
        UUID userId = repository.activateCompanyAccount(tokens.hashOpaqueToken(token), passwords.encode(password))
                .orElseThrow(() -> new AppException(ErrorType.INVALID_INPUT, "AUTH_ACTIVATION_TOKEN_INVALID",
                        "Liên kết kích hoạt không hợp lệ hoặc đã hết hạn."));
        audit.record(userId, "COMPANY_ACCOUNT_ACTIVATED", "USER", userId, Map.of(), metadata);
    }

    public UserDto getCurrentUser(UUID userId) {
        AuthUser user = repository.findUserById(userId).orElse(null);
        if (user == null || user.status() != UserStatus.ACTIVE) {
            throw new AppException(ErrorType.UNAUTHENTICATED, "AUTH_SESSION_USER_INACTIVE",
                    "Tài khoản không còn hoạt động.");
        }
        return UserDto.from(user);
    }

    private IssuedSession issueSession(AuthUser user, RequestMetadata metadata) {
        String refreshToken = tokens.createRefreshToken();
        repository.createRefreshToken(UUID.randomUUID(), user.id(), UUID.randomUUID(),
                tokens.hashOpaqueToken(refreshToken), refreshExpiry(), metadata);
        TokenService.AccessToken access = tokens.signAccessToken(user);
        return new IssuedSession(refreshToken, new SessionResponse(access.accessToken(), access.expiresIn(), UserDto.from(user)));
    }

    private Instant refreshExpiry() { return Instant.now().plus(configuration.refreshTokenTtlDays(), ChronoUnit.DAYS); }

    private boolean isAllowedStudentEmail(String email) {
        int separator = email.lastIndexOf('@');
        return separator > 0 && configuration.allowedStudentEmailDomains().contains(email.substring(separator + 1).toLowerCase());
    }

    private AppException invalidCredentials() {
        return new AppException(ErrorType.UNAUTHENTICATED, "AUTH_INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác.");
    }

}
