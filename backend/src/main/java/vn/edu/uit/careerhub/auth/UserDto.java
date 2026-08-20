package vn.edu.uit.careerhub.auth;

import java.util.UUID;

public record UserDto(
        UUID id,
        String email,
        UserRole role,
        UserStatus status,
        String displayName,
        String organization,
        UUID studentProfileId,
        UUID companyId) {}
