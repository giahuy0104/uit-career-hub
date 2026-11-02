package vn.edu.uit.careerhub.entity;

import java.util.UUID;

public record LockedInterview(String status, UUID applicationId, UUID companyId) {}
