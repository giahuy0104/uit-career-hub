package vn.edu.uit.careerhub.entity;

import java.time.Instant;
import java.util.UUID;

import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.enums.UserStatus;

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

}
