package vn.edu.uit.careerhub.entity;

import java.util.UUID;

import vn.edu.uit.careerhub.enums.ApplicationStatus;

public record LockedApplication(UUID id,ApplicationStatus status,int version,UUID studentProfileId,UUID studentUserId,
        String studentFullName,UUID jobId,String jobTitle,UUID companyId,String companyName) {}
