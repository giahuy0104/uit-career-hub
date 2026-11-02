package vn.edu.uit.careerhub.entity;

import java.util.UUID;

import vn.edu.uit.careerhub.enums.UserStatus;

public record LockedRecruiter(UUID userId, UUID companyId, UserStatus status, String passwordHash, String suspensionReason) {}
