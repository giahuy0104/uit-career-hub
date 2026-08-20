package vn.edu.uit.careerhub.auth;

import java.time.Instant;
import java.util.UUID;

public record AuthUser(
        UUID id,
        String email,
        UserRole role,
        UserStatus status,
        String passwordHash,
        int failedLoginAttempts,
        Instant lockedUntil,
        String displayName,
        String organization,
        UUID studentProfileId,
        UUID companyId) {

    public UserDto toDto() {
        return new UserDto(id, email, role, status, displayName, organization, studentProfileId, companyId);
    }
}
