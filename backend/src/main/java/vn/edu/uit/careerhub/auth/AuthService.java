package vn.edu.uit.careerhub.auth;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.config.AppProperties;

@Service
public class AuthService {
    private final AuthRepository repository;
    private final TokenService tokens;
    private final PasswordEncoder passwords;
    private final AppProperties.Security configuration;

    public AuthService(AuthRepository repository, TokenService tokens, PasswordEncoder passwords, AppProperties properties) {
        this.repository = repository;
        this.tokens = tokens;
        this.passwords = passwords;
        this.configuration = properties.security();
    }

    public IssuedSession login(String email, String password, RequestMetadata metadata) {
        AuthUser user = repository.findUserByEmail(email.toLowerCase()).orElse(null);
        if (user == null || user.passwordHash() == null) {
            repository.recordAudit(user == null ? null : user.id(), "AUTH_LOGIN_FAILED", "USER",
                    user == null ? null : user.id(), Map.of("reason", "INVALID_CREDENTIALS"), metadata);
            throw invalidCredentials();
        }
        if (user.status() == UserStatus.LOCKED && user.lockedUntil() != null
                && !user.lockedUntil().isAfter(Instant.now())) {
            repository.unlockIfExpired(user.id());
            user = repository.findUserById(user.id()).orElse(user);
        }
        if (user.status() == UserStatus.LOCKED) {
            throw new AppException(HttpStatus.LOCKED, "AUTH_ACCOUNT_LOCKED",
                    "Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau.");
        }
        if (!passwords.matches(password, user.passwordHash())) {
            repository.recordFailedLogin(user.id());
            repository.recordAudit(user.id(), "AUTH_LOGIN_FAILED", "USER", user.id(),
                    Map.of("reason", "INVALID_CREDENTIALS"), metadata);
            throw invalidCredentials();
        }
        if (user.status() != UserStatus.ACTIVE) {
            throw new AppException(HttpStatus.FORBIDDEN, "AUTH_ACCOUNT_INACTIVE",
                    "Tài khoản chưa được kích hoạt hoặc đã bị tạm ngưng.");
        }
        if (user.role() == UserRole.STUDENT && !isAllowedStudentEmail(user.email())) {
            throw new AppException(HttpStatus.FORBIDDEN, "AUTH_STUDENT_EMAIL_NOT_ALLOWED",
                    "Tài khoản sinh viên phải sử dụng email UIT hợp lệ.");
        }
        repository.markLoginSucceeded(user.id());
        repository.recordAudit(user.id(), "AUTH_LOGIN_SUCCEEDED", "USER", user.id(), Map.of(), metadata);
        return issueSession(user, metadata);
    }

    public IssuedSession refresh(String refreshToken, RequestMetadata metadata) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "AUTH_REFRESH_TOKEN_MISSING", "Phiên đăng nhập không tồn tại.");
        }
        String nextToken = tokens.createRefreshToken();
        AuthUser user = repository.rotateRefreshToken(tokens.hashOpaqueToken(refreshToken), UUID.randomUUID(),
                tokens.hashOpaqueToken(nextToken), refreshExpiry(), metadata).orElseThrow(() ->
                    new AppException(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_REFRESH_TOKEN",
                            "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."));
        TokenService.AccessToken access = tokens.signAccessToken(user);
        return new IssuedSession(nextToken, new Session(access.accessToken(), access.expiresIn(), user.toDto()));
    }

    public void logout(String refreshToken, RequestMetadata metadata) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            repository.revokeRefreshToken(tokens.hashOpaqueToken(refreshToken));
        }
        repository.recordAudit(null, "AUTH_LOGOUT", "AUTH_SESSION", null, Map.of(), metadata);
    }

    public void activateCompanyAccount(String token, String password, RequestMetadata metadata) {
        UUID userId = repository.activateCompanyAccount(tokens.hashOpaqueToken(token), passwords.encode(password))
                .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, "AUTH_ACTIVATION_TOKEN_INVALID",
                        "Liên kết kích hoạt không hợp lệ hoặc đã hết hạn."));
        repository.recordAudit(userId, "COMPANY_ACCOUNT_ACTIVATED", "USER", userId, Map.of(), metadata);
    }

    public UserDto getCurrentUser(UUID userId) {
        AuthUser user = repository.findUserById(userId).orElse(null);
        if (user == null || user.status() != UserStatus.ACTIVE) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "AUTH_SESSION_USER_INACTIVE",
                    "Tài khoản không còn hoạt động.");
        }
        return user.toDto();
    }

    private IssuedSession issueSession(AuthUser user, RequestMetadata metadata) {
        String refreshToken = tokens.createRefreshToken();
        repository.createRefreshToken(UUID.randomUUID(), user.id(), UUID.randomUUID(),
                tokens.hashOpaqueToken(refreshToken), refreshExpiry(), metadata);
        TokenService.AccessToken access = tokens.signAccessToken(user);
        return new IssuedSession(refreshToken, new Session(access.accessToken(), access.expiresIn(), user.toDto()));
    }

    private Instant refreshExpiry() { return Instant.now().plus(configuration.refreshTokenTtlDays(), ChronoUnit.DAYS); }

    private boolean isAllowedStudentEmail(String email) {
        int separator = email.lastIndexOf('@');
        return separator > 0 && configuration.allowedStudentEmailDomains().contains(email.substring(separator + 1).toLowerCase());
    }

    private AppException invalidCredentials() {
        return new AppException(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác.");
    }

    public record IssuedSession(String refreshToken, Session session) {}
    public record Session(String accessToken, long expiresIn, UserDto user) {}
}
