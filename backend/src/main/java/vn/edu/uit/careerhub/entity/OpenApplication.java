package vn.edu.uit.careerhub.entity;

import java.util.UUID;

public record OpenApplication(UUID id, String status, String jobTitle, UUID companyId) {}
