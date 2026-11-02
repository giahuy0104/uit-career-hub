package vn.edu.uit.careerhub.entity;

import java.time.LocalDate;
import java.util.UUID;

import vn.edu.uit.careerhub.enums.PlacementStatus;

public record LockedPlacement(UUID id,UUID applicationId,PlacementStatus status,int version,LocalDate actualStartDate,UUID studentUserId,
        String studentName,String jobTitle,UUID companyId,String companyName) {}
