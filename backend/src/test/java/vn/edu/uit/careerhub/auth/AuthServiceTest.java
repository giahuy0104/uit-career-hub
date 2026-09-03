package vn.edu.uit.careerhub.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.config.AppProperties;

/**
 * Covers the login/lockout/refresh-rotation rules from ADR 002 (docs/decisions/002): failed
 * login handling, account lockout expiry, inactive-account and student-email-domain checks, and
 * refresh-token rotation. Uses a real TokenService (cheap, deterministic) and mocks only the
 * repository/password-hashing dependencies.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    @Mock private AuthRepository repository;
    @Mock private PasswordEncoder passwords;

    private AuthService service;
    private final RequestMetadata request = new RequestMetadata("127.0.0.1", "JUnit");

    @BeforeEach void wireService() {
        AppProperties properties = new AppProperties("test", "http://localhost:5173", "http://localhost:5173",
                new AppProperties.Database("postgresql://localhost/test", "", 5),
                new AppProperties.Security("0123456789abcdefghijklmnopqrstuvwxyz", "issuer", "audience", 900, 7,
                        "refresh", false, "lax", "student.uit.edu.vn"),
                new AppProperties.Email(false, "", "", 10, 5),
                new AppProperties.Storage(false, "", "", "", "bucket", 600, 300), "cron-secret");
        service = new AuthService(repository, new TokenService(properties), passwords, properties);
    }

    @Test void loginRejectsAnUnknownEmail() {
        when(repository.findUserByEmail("nobody@student.uit.edu.vn")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.login("nobody@student.uit.edu.vn", "whatever", request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("AUTH_INVALID_CREDENTIALS");
        verify(repository).recordAudit(isNull(), eq("AUTH_LOGIN_FAILED"), eq("USER"), isNull(), any(), eq(request));
    }

    @Test void loginRejectsAnAccountWithoutAPasswordYet() {
        AuthUser pending = user(UserStatus.PENDING_ACTIVATION, null, UserRole.COMPANY, 0, null);
        when(repository.findUserByEmail(pending.email())).thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> service.login(pending.email(), "whatever", request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("AUTH_INVALID_CREDENTIALS");
    }

    @Test void loginRejectsAStillLockedAccount() {
        AuthUser locked = user(UserStatus.LOCKED, "hash", UserRole.UIT_ADMIN, 5, Instant.now().plusSeconds(600));
        when(repository.findUserByEmail(locked.email())).thenReturn(Optional.of(locked));

        assertThatThrownBy(() -> service.login(locked.email(), "whatever", request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("AUTH_ACCOUNT_LOCKED");
        verify(repository, never()).unlockIfExpired(any());
    }

    @Test void loginUnlocksAnExpiredLockBeforeCheckingThePassword() {
        AuthUser locked = user(UserStatus.LOCKED, "hash", UserRole.UIT_ADMIN, 5, Instant.now().minusSeconds(60));
        AuthUser unlocked = user(UserStatus.ACTIVE, "hash", UserRole.UIT_ADMIN, 0, null);
        when(repository.findUserByEmail(locked.email())).thenReturn(Optional.of(locked));
        when(repository.findUserById(locked.id())).thenReturn(Optional.of(unlocked));
        when(passwords.matches("correct", "hash")).thenReturn(true);

        AuthService.IssuedSession session = service.login(locked.email(), "correct", request);

        verify(repository).unlockIfExpired(locked.id());
        assertThat(session.session().user().role()).isEqualTo(UserRole.UIT_ADMIN);
    }

    @Test void loginRejectsAWrongPasswordAndRecordsTheFailedAttempt() {
        AuthUser active = user(UserStatus.ACTIVE, "hash", UserRole.UIT_ADMIN, 0, null);
        when(repository.findUserByEmail(active.email())).thenReturn(Optional.of(active));
        when(passwords.matches("wrong", "hash")).thenReturn(false);

        assertThatThrownBy(() -> service.login(active.email(), "wrong", request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("AUTH_INVALID_CREDENTIALS");
        verify(repository).recordFailedLogin(active.id());
    }

    @Test void loginRejectsASuspendedAccountEvenWithACorrectPassword() {
        AuthUser suspended = user(UserStatus.SUSPENDED, "hash", UserRole.COMPANY, 0, null);
        when(repository.findUserByEmail(suspended.email())).thenReturn(Optional.of(suspended));
        when(passwords.matches("correct", "hash")).thenReturn(true);

        assertThatThrownBy(() -> service.login(suspended.email(), "correct", request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("AUTH_ACCOUNT_INACTIVE");
    }

    @Test void loginRejectsAStudentEmailOutsideTheUitDomains() {
        AuthUser outsider = new AuthUser(UUID.randomUUID(), "someone@gmail.com", UserRole.STUDENT, UserStatus.ACTIVE,
                "hash", 0, null, "Someone", "N/A", UUID.randomUUID(), null);
        when(repository.findUserByEmail(outsider.email())).thenReturn(Optional.of(outsider));
        when(passwords.matches("correct", "hash")).thenReturn(true);

        assertThatThrownBy(() -> service.login(outsider.email(), "correct", request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("AUTH_STUDENT_EMAIL_NOT_ALLOWED");
    }

    @Test void loginSucceedsAndIssuesASessionForAValidStudent() {
        AuthUser student = new AuthUser(UUID.randomUUID(), "20521067@student.uit.edu.vn", UserRole.STUDENT,
                UserStatus.ACTIVE, "hash", 0, null, "Nguyen Van A", "20521067", UUID.randomUUID(), null);
        when(repository.findUserByEmail(student.email())).thenReturn(Optional.of(student));
        when(passwords.matches("correct", "hash")).thenReturn(true);

        AuthService.IssuedSession session = service.login(student.email(), "correct", request);

        assertThat(session.refreshToken()).hasSize(64);
        assertThat(session.session().accessToken()).isNotBlank();
        assertThat(session.session().user().studentProfileId()).isEqualTo(student.studentProfileId());
        verify(repository).markLoginSucceeded(student.id());
        verify(repository).recordAudit(eq(student.id()), eq("AUTH_LOGIN_SUCCEEDED"), eq("USER"), eq(student.id()), any(), eq(request));
    }

    @Test void refreshRejectsAMissingToken() {
        assertThatThrownBy(() -> service.refresh(null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("AUTH_REFRESH_TOKEN_MISSING");
        assertThatThrownBy(() -> service.refresh("  ", request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("AUTH_REFRESH_TOKEN_MISSING");
    }

    @Test void refreshRejectsATokenThatCannotBeRotated() {
        when(repository.rotateRefreshToken(any(), any(), any(), any(), eq(request))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.refresh("some-opaque-refresh-token", request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("AUTH_INVALID_REFRESH_TOKEN");
    }

    @Test void refreshRotatesToANewOpaqueTokenOnSuccess() {
        AuthUser active = user(UserStatus.ACTIVE, "hash", UserRole.UIT_ADMIN, 0, null);
        when(repository.rotateRefreshToken(any(), any(), any(), any(), eq(request))).thenReturn(Optional.of(active));

        AuthService.IssuedSession session = service.refresh("some-opaque-refresh-token", request);

        assertThat(session.refreshToken()).hasSize(64).isNotEqualTo("some-opaque-refresh-token");
        assertThat(session.session().user().role()).isEqualTo(UserRole.UIT_ADMIN);
    }

    @Test void logoutRevokesTheTokenOnlyWhenOnePresentButAlwaysAudits() {
        service.logout("some-token", request);
        verify(repository, times(1)).revokeRefreshToken(any());
        verify(repository).recordAudit(isNull(), eq("AUTH_LOGOUT"), eq("AUTH_SESSION"), isNull(), any(), eq(request));

        service.logout(null, request);
        verify(repository, times(1)).revokeRefreshToken(any());
        verify(repository, times(2)).recordAudit(isNull(), eq("AUTH_LOGOUT"), eq("AUTH_SESSION"), isNull(), any(), eq(request));
    }

    @Test void activateCompanyAccountRejectsAnInvalidOrExpiredToken() {
        when(repository.activateCompanyAccount(any(), any())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.activateCompanyAccount("token", "Password@123", request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("AUTH_ACTIVATION_TOKEN_INVALID");
    }

    @Test void getCurrentUserRejectsAnInactiveOrMissingAccount() {
        UUID userId = UUID.randomUUID();
        when(repository.findUserById(userId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getCurrentUser(userId))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("AUTH_SESSION_USER_INACTIVE");

        AuthUser suspended = user(UserStatus.SUSPENDED, "hash", UserRole.COMPANY, 0, null);
        when(repository.findUserById(suspended.id())).thenReturn(Optional.of(suspended));
        assertThatThrownBy(() -> service.getCurrentUser(suspended.id()))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("AUTH_SESSION_USER_INACTIVE");
    }

    @Test void getCurrentUserReturnsTheDtoForAnActiveAccount() {
        AuthUser active = user(UserStatus.ACTIVE, "hash", UserRole.UIT_ADMIN, 0, null);
        when(repository.findUserById(active.id())).thenReturn(Optional.of(active));

        UserDto dto = service.getCurrentUser(active.id());

        assertThat(dto.id()).isEqualTo(active.id());
        assertThat(dto.role()).isEqualTo(UserRole.UIT_ADMIN);
    }

    private AuthUser user(UserStatus status, String passwordHash, UserRole role, int failedAttempts, Instant lockedUntil) {
        return new AuthUser(UUID.randomUUID(), "admin.career@uit.edu.vn", role, status, passwordHash, failedAttempts,
                lockedUntil, "Test User", "UIT", null, null);
    }
}
